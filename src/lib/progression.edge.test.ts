import { describe, expect, it } from "vitest";
import {
  BREAK_DAYS,
  daysBetween,
  increment,
  nextTarget,
  parseRange,
  targetLabel,
  targetReason,
  type Lift,
} from "./progression";

const bench: Lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "chest" };
const squat: Lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "quads" };
const rdl: Lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "hamstrings" };
const hipThrust: Lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "glutes" };
const curl: Lift = { equipment: "dumbbell", mechanic: "isolation", primaryMuscle: "biceps" };
const pullup: Lift = { equipment: "bodyweight", mechanic: "compound", primaryMuscle: "back" };

const s = (weight: number, reps: number, rpe: number | null = null) => ({ weight, reps, rpe });

describe("progression edge cases", () => {
  describe("break days threshold: 20 vs 21 vs 22 days off", () => {
    it("verifies BREAK_DAYS constant is 21", () => {
      expect(BREAK_DAYS).toBe(21);
    });

    it("does not ease load at 20 days off (normal progression applies)", () => {
      const res = nextTarget({
        last: [s(100, 8), s(100, 8)],
        range: "6-8",
        lift: bench,
        unit: "kg",
        daysOff: 20,
      });
      // Normal progression: top of range reached -> go up
      expect(res).toMatchObject({ weight: 102.5, reps: 6, change: "up" });
      expect(res?.weeksOff).toBeUndefined();
    });

    it("eases load by about 10% at exactly 21 days off", () => {
      const res = nextTarget({
        last: [s(100, 8), s(100, 8)],
        range: "6-8",
        lift: bench,
        unit: "kg",
        daysOff: 21,
      });
      // 100 kg * 0.9 = 90 kg
      expect(res).toEqual({
        weight: 90,
        reps: 8,
        change: "back",
        added: 0,
        weeksOff: 3,
      });
      expect(targetReason(res!, "kg")).toBe("10% under, 3 weeks off");
    });

    it("eases load by about 10% at 22 days off", () => {
      const res = nextTarget({
        last: [s(100, 8), s(100, 8)],
        range: "6-8",
        lift: bench,
        unit: "kg",
        daysOff: 22,
      });
      expect(res).toEqual({
        weight: 90,
        reps: 8,
        change: "back",
        added: 0,
        weeksOff: 3,
      });
    });

    it("computes calendar days between dates across DST and months", () => {
      expect(daysBetween("2026-10-01", "2026-10-21")).toBe(20);
      expect(daysBetween("2026-10-01", "2026-10-22")).toBe(21);
      expect(daysBetween("2026-10-01", "2026-10-23")).toBe(22);
      // Across US DST clocks fallback
      expect(daysBetween("2026-10-25", "2026-11-08")).toBe(14);
      // Same day
      expect(daysBetween("2026-11-01", "2026-11-01")).toBe(0);
      // Reverse direction
      expect(daysBetween("2026-11-05", "2026-11-01")).toBe(-4);
    });
  });

  describe("increment jumps across lift muscle groups and equipment", () => {
    it("gives 5 kg / 10 lb increments for all compound lower body barbell lifts", () => {
      expect(increment(squat, "kg")).toBe(5);
      expect(increment(squat, "lb")).toBe(10);
      expect(increment(rdl, "kg")).toBe(5);
      expect(increment(rdl, "lb")).toBe(10);
      expect(increment(hipThrust, "kg")).toBe(5);
      expect(increment(hipThrust, "lb")).toBe(10);
    });

    it("gives 2.5 kg / 5 lb increments for upper body barbell lifts", () => {
      expect(increment(bench, "kg")).toBe(2.5);
      expect(increment(bench, "lb")).toBe(5);
    });

    it("gives 2 kg / 5 lb increments for dumbbells", () => {
      expect(increment(curl, "kg")).toBe(2);
      expect(increment(curl, "lb")).toBe(5);
    });
  });

  describe("invalid, empty, and bodyweight inputs", () => {
    it("returns null when set history is empty", () => {
      expect(nextTarget({ last: [], range: "6-8", lift: bench, unit: "kg" })).toBeNull();
    });

    it("filters out sets with zero reps or negative weights", () => {
      const sets = [s(-10, 5), s(80, 0), s(80, -2)];
      expect(nextTarget({ last: sets, range: "6-8", lift: bench, unit: "kg" })).toBeNull();
    });

    it("advances unweighted bodyweight work in reps, not weight", () => {
      const sets = [s(0, 10), s(0, 10)];
      const res = nextTarget({ last: sets, range: "8-10", lift: pullup, unit: "kg" });
      expect(res).toEqual({ weight: 0, reps: 11, change: "same", added: 0 });
      expect(targetLabel(res!, "kg")).toBe("Bodyweight × 11");
    });

    it("reduces reps on unweighted bodyweight work after 21+ days off", () => {
      const sets = [s(0, 10), s(0, 10)];
      const res = nextTarget({ last: sets, range: "8-10", lift: pullup, unit: "kg", daysOff: 28 });
      // 10 * 0.9 = 9 reps
      expect(res).toEqual({ weight: 0, reps: 9, change: "back", added: 0, weeksOff: 4 });
      expect(targetLabel(res!, "kg")).toBe("Bodyweight × 9");
    });
  });

  describe("shortened workouts and all-out sets", () => {
    it("does not increase weight when planned set count was not completed", () => {
      // 2 sets completed out of 3 planned
      const sets = [s(80, 8), s(80, 8)];
      const res = nextTarget({
        last: sets,
        range: "6-8",
        lift: bench,
        unit: "kg",
        plannedSets: 3,
      });
      expect(res).toMatchObject({ weight: 80, reps: 8, change: "same", added: 0 });
    });

    it("increases weight when all planned sets reached the top of the range", () => {
      const sets = [s(80, 8), s(80, 8), s(80, 8)];
      const res = nextTarget({
        last: sets,
        range: "6-8",
        lift: bench,
        unit: "kg",
        plannedSets: 3,
      });
      expect(res).toMatchObject({ weight: 82.5, reps: 6, change: "up", added: 2.5 });
    });

    it("holds weight if last set RPE was all-out (>= 9.5) even if reps hit the top", () => {
      const sets = [s(80, 8), s(80, 8, 9.5)];
      const res = nextTarget({ last: sets, range: "6-8", lift: bench, unit: "kg" });
      expect(res).toMatchObject({ weight: 80, reps: 8, change: "same" });
    });
  });

  describe("parseRange boundaries", () => {
    it("parses single rep targets as range with lo === hi", () => {
      expect(parseRange("1")).toEqual([1, 1]);
      expect(parseRange("5")).toEqual([5, 5]);
    });

    it("rejects non-ranges, inverted ranges, and non-positive numbers", () => {
      expect(parseRange("0")).toBeNull();
      expect(parseRange("0-5")).toBeNull();
      expect(parseRange("10-5")).toBeNull();
      expect(parseRange("")).toBeNull();
      expect(parseRange("any")).toBeNull();
    });
  });
});
