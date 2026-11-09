import { describe, expect, it } from "vitest";
import { formatElapsed, STALE_CLOCK_MS } from "./workout-clock";

describe("workout-clock edge cases", () => {
  it("formats zero elapsed time", () => {
    expect(formatElapsed(0)).toBe("0:00");
  });

  it("formats seconds under one minute without padding the minute", () => {
    expect(formatElapsed(5_000)).toBe("0:05");
    expect(formatElapsed(59_000)).toBe("0:59");
  });

  it("formats minutes and seconds under an hour", () => {
    expect(formatElapsed(5 * 60_000 + 3_000)).toBe("5:03");
    expect(formatElapsed(10 * 60_000)).toBe("10:00");
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("transitions to hours format at exactly 3600 seconds", () => {
    expect(formatElapsed(3_600_000)).toBe("1h 00m");
  });

  it("drops seconds once past an hour and pads minutes", () => {
    expect(formatElapsed(3_600_000 + 59_000)).toBe("1h 00m");
    expect(formatElapsed(3_600_000 + 60_000)).toBe("1h 01m");
    expect(formatElapsed(3_600_000 + 9 * 60_000 + 30_000)).toBe("1h 09m");
  });

  it("clamps negative elapsed times from future start times to 0:00", () => {
    expect(formatElapsed(-1)).toBe("0:00");
    expect(formatElapsed(-10_000)).toBe("0:00");
    expect(formatElapsed(-3_600_000)).toBe("0:00");
  });

  it("formats elapsed time at the exact STALE_CLOCK_MS boundary (6 hours)", () => {
    expect(STALE_CLOCK_MS).toBe(6 * 60 * 60 * 1000);
    expect(formatElapsed(STALE_CLOCK_MS)).toBe("6h 00m");
    expect(formatElapsed(STALE_CLOCK_MS + 15 * 60_000)).toBe("6h 15m");
  });

  it("formats multi-hour and multi-day workout durations", () => {
    expect(formatElapsed(10 * 3_600_000)).toBe("10h 00m");
    expect(formatElapsed(24 * 3_600_000 + 30 * 60_000)).toBe("24h 30m");
  });

  it("correctly floors sub-second millisecond fractions", () => {
    expect(formatElapsed(65_999)).toBe("1:05");
    expect(formatElapsed(3_600_999)).toBe("1h 00m");
  });
});
