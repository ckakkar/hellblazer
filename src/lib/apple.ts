import { createPrivateKey, sign } from "node:crypto";

// Server-only: signs with the Apple private key. Never import from client code.

/** The iOS app's bundle ID (capacitor.config.ts), also its Apple "client ID". */
export const APP_BUNDLE_ID = "com.kkrwhofrags.hellblazer";

type AppleKey = { teamId: string; keyId: string; privateKey: string };

/**
 * The server key from Apple's developer portal (APNs + Sign in with Apple),
 * or null until APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY are set.
 */
export function appleKey(): AppleKey | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKey) return null;
  // Tolerate a key pasted with literal "\n"s instead of line breaks.
  return { teamId, keyId, privateKey: privateKey.replace(/\\n/g, "\n") };
}

/** An ES256 JWT signed with the server key: what APNs and Apple ID both expect. */
export function signAppleJwt(key: AppleKey, claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "ES256", kid: key.keyId })}.${part(claims)}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: createPrivateKey(key.privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${unsigned}.${signature}`;
}

/** Sign in with Apple's "client secret": a short-lived JWT, not a stored value. */
function clientSecret(key: AppleKey) {
  const now = Math.floor(Date.now() / 1000);
  return signAppleJwt(key, {
    iss: key.teamId,
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: APP_BUNDLE_ID,
  });
}

async function appleIdPost(path: string, params: Record<string, string>) {
  return fetch(`https://appleid.apple.com/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Trades the one-time authorization code from a native Apple sign-in for a
 * refresh token. The only use for it is revoking access when the account is
 * deleted, which App Store rules require. Null when unconfigured or refused.
 */
export async function exchangeAppleCode(code: string): Promise<string | null> {
  const key = appleKey();
  if (!key) return null;
  try {
    const res = await appleIdPost("token", {
      client_id: APP_BUNDLE_ID,
      client_secret: clientSecret(key),
      code,
      grant_type: "authorization_code",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { refresh_token?: string };
    return json.refresh_token ?? null;
  } catch {
    return null;
  }
}

/** Revokes the app's Sign in with Apple access for a user. */
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  const key = appleKey();
  if (!key) return false;
  try {
    const res = await appleIdPost("revoke", {
      client_id: APP_BUNDLE_ID,
      client_secret: clientSecret(key),
      token: refreshToken,
      token_type_hint: "refresh_token",
    });
    return res.ok;
  } catch {
    return false;
  }
}
