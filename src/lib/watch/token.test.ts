import { describe, expect, it } from "vitest";
import { bearerToken, hashWatchToken, newWatchToken } from "./token";

describe("watch tokens", () => {
  it("are long, URL-safe and never repeat", () => {
    const a = newWatchToken();
    const b = newWatchToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("are stored as a SHA-256 hex digest", () => {
    const token = newWatchToken();
    expect(hashWatchToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashWatchToken(token)).toBe(hashWatchToken(token));
    expect(hashWatchToken(token)).not.toBe(hashWatchToken(newWatchToken()));
  });

  it("come only from a well-formed bearer header", () => {
    const token = newWatchToken();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken(`Basic ${token}`)).toBeNull();
    expect(bearerToken("Bearer short")).toBeNull();
    expect(bearerToken(`Bearer ${token}; drop table`)).toBeNull();
    expect(bearerToken(`Bearer ${"a".repeat(129)}`)).toBeNull();
  });
});
