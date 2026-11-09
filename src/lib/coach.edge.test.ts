import { describe, expect, it } from "vitest";
import { coachLine, notebookSets, repsToBeat, type CoachInput } from "./coach";

describe("coach edge cases", () => {
  describe("notebookSets formatting", () => {
    it("returns empty string when sets array is empty", () => {
      expect(notebookSets([], "kg")).toBe("");
      expect(notebookSets([], "lb")).toBe("");
    });

    it("formats a single set with weight and reps", () => {
      expect(notebookSets([{ weight: 60, reps: 8 }], "kg")).toBe("60 kg × 8");
      expect(notebookSets([{ weight: 135, reps: 5 }], "lb")).toBe("135 lb × 5");
    });

    it("formats a single bodyweight set as BW", () => {
      expect(notebookSets([{ weight: 0, reps: 10 }], "kg")).toBe("BW × 10");
    });

    it("formats multiple bodyweight sets with comma-separated reps", () => {
      expect(
        notebookSets(
          [
            { weight: 0, reps: 12 },
            { weight: 0, reps: 10 },
            { weight: 0, reps: 8 },
          ],
          "kg",
        ),
      ).toBe("BW × 12, 10, 8");
    });

    it("formats mixed bodyweight and weighted sets with unit at end", () => {
      expect(
        notebookSets(
          [
            { weight: 0, reps: 10 },
            { weight: 10, reps: 8 },
          ],
          "kg",
        ),
      ).toBe("BW × 10, 10 × 8 kg");
    });

    it("compresses reps when all sets share the same non-zero weight", () => {
      expect(
        notebookSets(
          [
            { weight: 82.5, reps: 8 },
            { weight: 82.5, reps: 8 },
            { weight: 82.5, reps: 7 },
          ],
          "kg",
        ),
      ).toBe("82.5 kg × 8, 8, 7");
    });

    it("prints weights per set when weights vary across sets", () => {
      expect(
        notebookSets(
          [
            { weight: 60, reps: 10 },
            { weight: 62.5, reps: 8 },
            { weight: 65, reps: 6 },
          ],
          "kg",
        ),
      ).toBe("60 × 10, 62.5 × 8, 65 × 6 kg");
    });
  });

  describe("repsToBeat precision calculation", () => {
    it("returns null for non-positive weight or PR", () => {
      expect(repsToBeat(0, 100)).toBeNull();
      expect(repsToBeat(-50, 100)).toBeNull();
      expect(repsToBeat(100, 0)).toBeNull();
      expect(repsToBeat(100, -10)).toBeNull();
    });

    it("returns 1 rep when target weight alone exceeds the prior best max", () => {
      expect(repsToBeat(130, 120)).toBe(1);
    });

    it(
      "a tie isn't a record: at 100 kg against a best of 120, it takes 7 reps (6 only ties)",
      () => {
        // Input: weightKg = 100, bestEst1rm = 120
        // Actual output: 6
        // Expected output: 7 (at 100 kg, 6 reps gives exactly 100 * (1 + 6/30) = 120 kg, which ties but does NOT beat 120 kg. 7 reps are required to beat it).
        // Why it happens: (120 / 100 - 1) produces 0.19999999999999996 in IEEE-754.
        // 30 * 0.19999999999999996 = 5.999999999999999. Math.floor gives 5 instead of 6, returning 5 + 1 = 6.
        expect(repsToBeat(100, 120)).toBe(7);
      },
    );

    it("calculates reps needed when target does not tie prior PR", () => {
      // 80 kg with PR of 100: 80 * (1 + 7/30) = 98.67; 80 * (1 + 8/30) = 101.33 -> 8 reps.
      expect(repsToBeat(80, 100)).toBe(8);
      // 100 kg with PR of 121 -> 7 reps
      expect(repsToBeat(100, 121)).toBe(7);
    });
  });

  describe("coachLine observation logic", () => {
    const base: CoachInput = {
      exercises: 4,
      done: 0,
      records: 0,
      next: null,
      unit: "kg",
    };

    it("returns null when no conditions trigger a message", () => {
      expect(coachLine(base)).toBeNull();
    });

    it("congratulates when all exercises are completed without records", () => {
      expect(coachLine({ ...base, done: 4 })).toBe(
        "Every exercise done. Finish when you're ready.",
      );
    });

    it("highlights records broken when all exercises are done", () => {
      expect(coachLine({ ...base, done: 4, records: 1 })).toBe(
        "Every exercise done, a record broken. Finish when you're ready.",
      );
      expect(coachLine({ ...base, done: 4, records: 3 })).toBe(
        "Every exercise done, 3 records broken. Finish when you're ready.",
      );
    });

    it("shows break notice on first exercise after time off", () => {
      expect(coachLine({ ...base, breakWeeks: 3 })).toBe(
        "First workout in 3 weeks: targets are 10% under last time.",
      );
      // Disappears once first exercise is completed
      expect(coachLine({ ...base, breakWeeks: 3, done: 1 })).toBeNull();
    });

    it("suppresses reps to beat message when needed reps are out of reach (> target + 2)", () => {
      const next = {
        name: "Squat",
        targetWeight: 100,
        targetWeightKg: 100,
        targetReps: 5,
        bestEst1rm: 150, // repsToBeat(100, 150) = 16 reps (> 5 + 2 = 7)
      };
      expect(coachLine({ ...base, next })).toBeNull();
    });
  });
});
