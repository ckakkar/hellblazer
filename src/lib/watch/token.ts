import { createHash, randomBytes } from "node:crypto";

/**
 * The Apple Watch app's credential. The iPhone app gets one for the signed-in
 * lifter (linkWatch) and hands it to the watch, which sends it as a bearer
 * token to /api/watch/*. Only its SHA-256 is stored (watch_link.token_hash),
 * so a leaked table can't be replayed.
 */
export function newWatchToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashWatchToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token from an `Authorization: Bearer …` header, if well-formed. */
export function bearerToken(header: string | null): string | null {
  return header?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? null;
}
