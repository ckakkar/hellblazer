import { describe, expect, it } from "vitest";
import {
  clampRestDuration,
  DEFAULT_REST_SECONDS,
  formatRestClock,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  REST_CHOICES,
} from "./rest-timer";

describe("rest-timer edge cases", () => {
  it("formats 0 seconds as 0:00", () => {
    expect(formatRestClock(0)).toBe("0:00");
  });

  it("pads single-digit seconds with leading zero", () => {
    expect(formatRestClock(1)).toBe("0:01");
    expect(formatRestClock(9)).toBe("0:09");
    expect(formatRestClock(10)).toBe("0:10");
  });

  it("formats exact minute intervals", () => {
    expect(formatRestClock(60)).toBe("1:00");
    expect(formatRestClock(180)).toBe("3:00");
    expect(formatRestClock(600)).toBe("10:00");
  });

  it("floors sub-second values without rounding up prematurely", () => {
    expect(formatRestClock(59.9)).toBe("0:59");
    expect(formatRestClock(60.1)).toBe("1:00");
    expect(formatRestClock(89.99)).toBe("1:29");
  });

  it("clamps negative values to 0:00 in clock display", () => {
    expect(formatRestClock(-0.5)).toBe("0:00");
    expect(formatRestClock(-60)).toBe("0:00");
  });

  it("formats long rest durations across many minutes", () => {
    expect(formatRestClock(1200)).toBe("20:00");
    expect(formatRestClock(3600)).toBe("60:00");
  });

  it("clamps values below MIN_REST_SECONDS (15s)", () => {
    expect(clampRestDuration(-10)).toBe(MIN_REST_SECONDS);
    expect(clampRestDuration(0)).toBe(MIN_REST_SECONDS);
    expect(clampRestDuration(14)).toBe(MIN_REST_SECONDS);
    expect(clampRestDuration(14.9)).toBe(MIN_REST_SECONDS);
    expect(clampRestDuration(MIN_REST_SECONDS)).toBe(MIN_REST_SECONDS);
  });

  it("clamps values above MAX_REST_SECONDS (600s / 10m)", () => {
    expect(clampRestDuration(MAX_REST_SECONDS)).toBe(MAX_REST_SECONDS);
    expect(clampRestDuration(600.1)).toBe(MAX_REST_SECONDS);
    expect(clampRestDuration(1000)).toBe(MAX_REST_SECONDS);
  });

  it("ensures all predefined REST_CHOICES are within valid bounds and sorted", () => {
    expect(DEFAULT_REST_SECONDS).toBe(90);
    expect(REST_CHOICES.every((r) => r >= MIN_REST_SECONDS && r <= MAX_REST_SECONDS)).toBe(true);
    const sorted = [...REST_CHOICES].sort((a, b) => a - b);
    expect([...REST_CHOICES]).toEqual(sorted);
  });
});
