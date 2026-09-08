import { describe, expect, it } from "vitest";
import {
  clampRestDuration,
  formatRestClock,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
} from "./rest-timer";

describe("rest timer utilities", () => {
  it("formats whole-minute and sub-minute clocks", () => {
    expect(formatRestClock(0)).toBe("0:00");
    expect(formatRestClock(9)).toBe("0:09");
    expect(formatRestClock(90)).toBe("1:30");
    expect(formatRestClock(601.9)).toBe("10:01");
  });

  it("never displays negative time", () => {
    expect(formatRestClock(-2)).toBe("0:00");
  });

  it("clamps saved durations to the supported range", () => {
    expect(clampRestDuration(0)).toBe(MIN_REST_SECONDS);
    expect(clampRestDuration(75)).toBe(75);
    expect(clampRestDuration(900)).toBe(MAX_REST_SECONDS);
  });
});
