import { GOOGLE_IOS_CLIENT_ID } from "@/lib/native";

function randomHex(bytes: number) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `ok` means the page is already navigating into the app. */
export type InAppSignIn = { ok: true } | { ok: false; message: string | null };

/**
 * Google sign-in inside the iOS app. Google refuses OAuth in an embedded web
 * view, so the native Google SDK signs in and hands back an ID token, which
 * /auth/native turns into the same Supabase session cookies the website's
 * redirect flow sets.
 *
 * On failure, `message` is what to tell the user, or null when the user
 * simply cancelled.
 */
export async function signInWithGoogleInApp(next: string): Promise<InAppSignIn> {
  const fail = (message: string | null): InAppSignIn => ({ ok: false, message });
  if (!GOOGLE_IOS_CLIENT_ID) return fail("Google sign-in isn't set up in the app yet.");

  // Google writes the hash of this nonce into the ID token; Supabase gets the
  // raw value and checks the hash matches, so a captured token can't be replayed.
  const nonce = randomHex(32);
  let idToken: string | null = null;
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({ google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, mode: "online" } });
    const { result } = await SocialLogin.login({
      provider: "google",
      // Always a fresh sign-in: the SDK's silent restore returns an old token
      // that carries an old nonce, which Supabase would reject.
      options: { nonce: await sha256Hex(nonce), forcePrompt: true },
    });
    if (result.responseType === "online") idToken = result.idToken;
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "USER_CANCELLED") return fail(null);
    return fail("Google sign-in didn't finish. Try again.");
  }
  if (!idToken) return fail("Google didn't return an ID token. Try again.");

  const res = await fetch("/auth/native", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", idToken, nonce, next }),
  });
  if (!res.ok) return fail("Couldn't sign you in. Try again.");
  const { redirect } = (await res.json()) as { redirect: string };
  window.location.replace(redirect);
  return { ok: true };
}
