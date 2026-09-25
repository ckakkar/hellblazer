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

const fail = (message: string | null): InAppSignIn => ({ ok: false, message });

function cancelled(err: unknown) {
  return (err as { code?: string } | null)?.code === "USER_CANCELLED";
}

/**
 * The provider's sheet hands back an ID token; /auth/native turns it into the
 * same Supabase session cookies the website's redirect flow sets, then says
 * where to go.
 */
async function finishSignIn(body: {
  provider: "google" | "apple";
  idToken: string;
  nonce: string;
  next: string;
  authorizationCode?: string;
  fullName?: string;
}): Promise<InAppSignIn> {
  const res = await fetch("/auth/native", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return fail("Couldn't sign you in. Try again.");
  const { redirect } = (await res.json()) as { redirect: string };
  window.location.replace(redirect);
  return { ok: true };
}

// Both providers write the SHA-256 of this nonce into the ID token; Supabase
// gets the raw value and checks the hash, so a captured token can't be replayed.

/**
 * Google sign-in inside the iOS app. Google refuses OAuth in embedded web
 * views, so the native Google SDK signs in instead. On failure, `message` is
 * what to tell the user, or null when they simply cancelled.
 */
export async function signInWithGoogleInApp(next: string): Promise<InAppSignIn> {
  if (!GOOGLE_IOS_CLIENT_ID) return fail("Google sign-in isn't set up in the app yet.");
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
    return fail(cancelled(err) ? null : "Google sign-in didn't finish. Try again.");
  }
  if (!idToken) return fail("Google didn't return an ID token. Try again.");
  return finishSignIn({ provider: "google", idToken, nonce, next });
}

/**
 * Sign in with Apple inside the iOS app, through Apple's own Face ID sheet.
 * Apple shares the user's name only on the very first sign-in, so it's passed
 * along for the profile.
 */
export async function signInWithAppleInApp(next: string): Promise<InAppSignIn> {
  const nonce = randomHex(32);
  let idToken: string | null = null;
  let authorizationCode: string | undefined;
  let fullName: string | undefined;
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    // An empty redirect keeps the exchange native; the proper-exchange mode
    // hands back the raw authorization code for the server to redeem.
    await SocialLogin.initialize({ apple: { redirectUrl: "", useProperTokenExchange: true } });
    const { result } = await SocialLogin.login({
      provider: "apple",
      options: { scopes: ["name", "email"], nonce: await sha256Hex(nonce) },
    });
    idToken = result.idToken;
    authorizationCode = result.authorizationCode ?? undefined;
    const name = [result.profile.givenName, result.profile.familyName].filter(Boolean).join(" ").trim();
    fullName = name || undefined;
  } catch (err) {
    return fail(cancelled(err) ? null : "Apple sign-in didn't finish. Try again.");
  }
  if (!idToken) return fail("Apple didn't return an ID token. Try again.");
  return finishSignIn({ provider: "apple", idToken, nonce, next, authorizationCode, fullName });
}
