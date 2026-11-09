import { describe, expect, it } from "vitest";
import { isLogged, isStraight, isWork } from "./set-kinds";

describe("set-kinds edge cases", () => {
  describe("isLogged validation", () => {
    it("accepts valid positive integer reps", () => {
      expect(isLogged(1)).toBe(true);
      expect(isLogged(10)).toBe(true);
      expect(isLogged(100)).toBe(true);
    });

    it("rejects zero reps (a draft row on the device)", () => {
      expect(isLogged(0)).toBe(false);
    });

    it("rejects negative reps", () => {
      expect(isLogged(-1)).toBe(false);
      expect(isLogged(-10)).toBe(false);
    });

    it("rejects non-integer fractions", () => {
      expect(isLogged(0.5)).toBe(false);
      expect(isLogged(1.5)).toBe(false);
      expect(isLogged(8.99)).toBe(false);
    });

    it("rejects null, undefined, NaN, and Infinity", () => {
      expect(isLogged(null)).toBe(false);
      expect(isLogged(undefined)).toBe(false);
      expect(isLogged(NaN)).toBe(false);
      expect(isLogged(Infinity)).toBe(false);
      expect(isLogged(-Infinity)).toBe(false);
    });
  });

  describe("isWork classification", () => {
    it("excludes all warm-up sets even with valid reps and special kinds", () => {
      expect(isWork({ warmup: true, reps: 10 })).toBe(false);
      expect(isWork({ warmup: true, kind: "drop", reps: 8 })).toBe(false);
      expect(isWork({ warmup: true, kind: "rest_pause", reps: 5 })).toBe(false);
    });

    it("excludes draft sets with missing, null, or 0 reps", () => {
      expect(isWork({ warmup: false, reps: null })).toBe(false);
      expect(isWork({ warmup: false, reps: undefined })).toBe(false);
      expect(isWork({ warmup: false, reps: 0 })).toBe(false);
    });

    it("includes drop sets and rest-pause sets as work", () => {
      expect(isWork({ warmup: false, kind: "drop", reps: 10 })).toBe(true);
      expect(isWork({ warmup: false, kind: "rest_pause", reps: 4 })).toBe(true);
    });
  });

  describe("isStraight classification", () => {
    it("classifies plain working sets as straight sets", () => {
      expect(isStraight({ warmup: false, reps: 10 })).toBe(true);
      expect(isStraight({ warmup: false, kind: null, reps: 10 })).toBe(true);
      expect(isStraight({ warmup: false, kind: undefined, reps: 10 })).toBe(true);
    });

    it("excludes extension sets (drop and rest_pause) from straight sets", () => {
      expect(isStraight({ warmup: false, kind: "drop", reps: 10 })).toBe(false);
      expect(isStraight({ warmup: false, kind: "rest_pause", reps: 4 })).toBe(false);
    });

    it("excludes warmups and drafts from straight sets", () => {
      expect(isStraight({ warmup: true, reps: 10 })).toBe(false);
      expect(isStraight({ warmup: false, reps: 0 })).toBe(false);
      expect(isStraight({ warmup: false, reps: null })).toBe(false);
    });
  });
});
