import { GOOGLE_IOS_CLIENT_ID } from "@/lib/native";
import { linkErrorMessage, type Provider } from "@/lib/auth-providers";

function randomHex(bytes: number) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}


/** `ok` means it worked (and, for sign-in, the page is already navigating). */
export type InAppAuth = { ok: true } | { ok: false; message: string | null };

const fail = (message: string | null): InAppAuth => ({ ok: false, message });

function cancelled(err: unknown) {
  return (err as { code?: string } | null)?.code === "USER_CANCELLED";
}

/** What a provider's native sheet hands back, ready for /auth/native. */
type Credential = {
  provider: Provider;
  idToken: string;
  nonce: string;
  /** Apple only: the one-time code, redeemed server-side for a revocable token. */
  authorizationCode?: string;
  /** Apple only: shared on the very first sign-in alone. */
  fullName?: string;
};

// Both providers write the SHA-256 of the nonce into the ID token; Supabase
// gets the raw value and checks the hash, so a captured token can't be replayed.

/**
 * Google's native sheet. Google refuses OAuth in embedded web views, so the
 * app can't use the website's redirect flow.
 */
async function googleCredential(): Promise<Credential | InAppAuth> {
  if (!GOOGLE_IOS_CLIENT_ID) return fail("Google sign-in isn't set up in the app yet.");
  const nonce = randomHex(32);
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({ google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, mode: "online" } });
    const { result } = await SocialLogin.login({
      provider: "google",
      // Always a fresh sign-in: the SDK's silent restore returns an old token
      // that carries an old nonce, which Supabase would reject.
      options: { nonce: await sha256Hex(nonce), forcePrompt: true },
    });
    const idToken = result.responseType === "online" ? result.idToken : null;
    if (!idToken) return fail("Google didn't return an ID token. Try again.");
    return { provider: "google", idToken, nonce };
  } catch (err) {
    return fail(cancelled(err) ? null : "Google didn't finish. Try again.");
  }
}

/** Apple's own Face ID sheet. */
async function appleCredential(): Promise<Credential | InAppAuth> {
  const nonce = randomHex(32);
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    // An empty redirect keeps the exchange native; the proper-exchange mode
    // hands back the raw authorization code for the server to redeem.
    await SocialLogin.initialize({ apple: { redirectUrl: "", useProperTokenExchange: true } });
    const { result } = await SocialLogin.login({
      provider: "apple",
      options: { scopes: ["name", "email"], nonce: await sha256Hex(nonce) },
    });
    if (!result.idToken) return fail("Apple didn't return an ID token. Try again.");
    const name = [result.profile.givenName, result.profile.familyName].filter(Boolean).join(" ").trim();
    return {
      provider: "apple",
      idToken: result.idToken,
      nonce,
      authorizationCode: result.authorizationCode ?? undefined,
      fullName: name || undefined,
    };
  } catch (err) {
    return fail(cancelled(err) ? null : "Apple didn't finish. Try again.");
  }
}

function credentialFor(provider: Provider) {
  return provider === "google" ? googleCredential() : appleCredential();
}

/** Sign in from the iOS app's landing page, then navigate into the app. */
export async function signInInApp(provider: Provider, next: string): Promise<InAppAuth> {
  const credential = await credentialFor(provider);
  if (!("idToken" in credential)) return credential;
  const res = await fetch("/auth/native", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...credential, next }),
  });
  if (!res.ok) return fail("Couldn't sign you in. Try again.");
  const { redirect } = (await res.json()) as { redirect: string };
  window.location.replace(redirect);
  return { ok: true };
}

/** Adds Google or Apple as another way into the signed-in account (iOS app). */
export async function linkInApp(provider: Provider): Promise<InAppAuth> {
  const credential = await credentialFor(provider);
  if (!("idToken" in credential)) return credential;
  const res = await fetch("/auth/native", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...credential, link: true }),
  });
  if (res.ok) return { ok: true };
  const { error } = (await res.json().catch(() => ({}))) as { error?: string };
  return fail(linkErrorMessage(error, provider));
}
