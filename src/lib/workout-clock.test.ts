import { describe, expect, it } from "vitest";
import { formatElapsed } from "./workout-clock";
import { isPushedRoute } from "./native-routes";

describe("formatElapsed", () => {
  it("reads M:SS under an hour", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("drops seconds past an hour", () => {
    expect(formatElapsed(3600_000)).toBe("1h 00m");
    expect(formatElapsed(3600_000 + 7 * 60_000 + 30_000)).toBe("1h 07m");
  });

  it("never goes negative", () => {
    expect(formatElapsed(-5000)).toBe("0:00");
  });
});

describe("isPushedRoute", () => {
  it("allows the swipe back on pages pushed onto a stack", () => {
    expect(isPushedRoute("/history/abc")).toBe(true);
    expect(isPushedRoute("/programs/abc")).toBe(true);
    expect(isPushedRoute("/privacy")).toBe(true);
  });

  it("keeps it off on tab roots and mid-workout", () => {
    expect(isPushedRoute("/history")).toBe(false);
    expect(isPushedRoute("/dashboard")).toBe(false);
    expect(isPushedRoute("/log/abc")).toBe(false);
    expect(isPushedRoute("/history/abc/edit")).toBe(false);
  });
});
