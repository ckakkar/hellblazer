import { describe, expect, it } from "vitest";
import {
  latestRecord,
  streakPlan,
  trainingDays,
  weekStreak,
  type StreakPlan,
  type StreakWorkout,
} from "./widget-moments";

describe("widget-moments edge cases", () => {
  describe("weekStreak across year ends and plan targets", () => {
    // 2026-12-28 is Monday of ISO week 53.
    // 2027-01-04 is Monday of ISO week 1 of 2027.
    // 2027-01-11 is Monday of ISO week 2 of 2027.
    it("maintains streak across the year end boundary (2026 to 2027)", () => {
      const workouts: StreakWorkout[] = [
        { date: "2026-12-22", programId: null }, // week of Dec 21
        { date: "2026-12-30", programId: null }, // week of Dec 28 (week 53)
        { date: "2027-01-06", programId: null }, // week of Jan 04 (week 1)
        { date: "2027-01-13", programId: null }, // week of Jan 11 (week 2)
      ];
      // Today is Wednesday Jan 13, 2027 (current week hit with 1 freeform workout)
      const streak = weekStreak(workouts, "2027-01-13", new Map(), null);
      expect(streak).toBe(4);
    });

    it("does not break streak when current week is still in progress and not yet hit", () => {
      const workouts: StreakWorkout[] = [
        { date: "2026-12-22", programId: null },
        { date: "2026-12-30", programId: null },
        { date: "2027-01-06", programId: null },
      ];
      // Today is Monday Jan 11, 2027 (current week has 0 workouts yet)
      const streak = weekStreak(workouts, "2027-01-11", new Map(), null);
      // Streak holds from prior completed weeks (3 weeks)
      expect(streak).toBe(3);
    });

    it("skips a week where the plan was paused start-to-end without breaking streak", () => {
      const plan: StreakPlan = {
        days: 3,
        paused: [{ from: "2026-10-12", to: "2026-10-18" }], // entire week of Oct 12 paused
      };
      const plans = new Map([["p1", plan]]);
      const workouts: StreakWorkout[] = [
        // Week of Oct 5 (hit: 3 workouts)
        { date: "2026-10-05", programId: "p1", planned: 3 },
        { date: "2026-10-07", programId: "p1", planned: 3 },
        { date: "2026-10-09", programId: "p1", planned: 3 },
        // Week of Oct 12: paused, 0 workouts
        // Week of Oct 19 (hit: 3 workouts)
        { date: "2026-10-19", programId: "p1", planned: 3 },
        { date: "2026-10-21", programId: "p1", planned: 3 },
        { date: "2026-10-23", programId: "p1", planned: 3 },
      ];
      // Today is Sunday Oct 25, 2026 (week of Oct 19 completed)
      const streak = weekStreak(workouts, "2026-10-25", plans, "p1");
      // Oct 5 (hit) + Oct 12 (paused, skipped) + Oct 19 (hit) = 2 weeks earned streak
      expect(streak).toBe(2);
    });

    it("breaks streak when a non-paused week falls short of the plan", () => {
      const plan: StreakPlan = { days: 3, paused: [] };
      const plans = new Map([["p1", plan]]);
      const workouts: StreakWorkout[] = [
        // Week of Oct 5: only 2 workouts (target 3)
        { date: "2026-10-05", programId: "p1", planned: 3 },
        { date: "2026-10-07", programId: "p1", planned: 3 },
        // Week of Oct 19: 3 workouts
        { date: "2026-10-19", programId: "p1", planned: 3 },
        { date: "2026-10-21", programId: "p1", planned: 3 },
        { date: "2026-10-23", programId: "p1", planned: 3 },
      ];
      const streak = weekStreak(workouts, "2026-10-25", plans, "p1");
      // Only the latest week counts
      expect(streak).toBe(1);
    });
  });

  describe("streakPlan pause calculation", () => {
    it("converts completed pauses and includes active pause up to today", () => {
      const program = {
        paused_at: "2026-11-05T10:00:00Z",
        pauses: [{ at: "2026-10-10", days: 4 }],
        program_day: [{}, {}, {}],
      };
      const plan = streakPlan(program, "2026-11-09");
      expect(plan.days).toBe(3);
      expect(plan.paused).toEqual([
        { from: "2026-10-10", to: "2026-10-13" },
        { from: "2026-11-05", to: "2026-11-09" },
      ]);
    });
  });

  describe("trainingDays calendar filtering", () => {
    it("deduplicates multiple sessions on the same date and sorts them", () => {
      const sessions = ["2026-11-05", "2026-11-03", "2026-11-05", "2026-11-01"];
      const days = trainingDays(sessions, "2026-11-09");
      expect(days).toEqual(["2026-11-01", "2026-11-03", "2026-11-05"]);
    });

    it("excludes sessions older than CALENDAR_WEEKS (26 weeks)", () => {
      // 26 weeks before 2026-11-09 is approximately May 2026
      const sessions = ["2025-10-01", "2026-11-01"];
      const days = trainingDays(sessions, "2026-11-09");
      expect(days).toEqual(["2026-11-01"]);
    });
  });

  describe("latestRecord selection and tie-breaking", () => {
    const lifts = [
      { id: "l1", name: "Bench Press", bestWeight: 100, bestReps: 5, estimatedMax: 116.67 },
      { id: "l2", name: "Incline Press", bestWeight: 80, bestReps: 8, estimatedMax: 101.33 },
      { id: "l3", name: "Squat", bestWeight: 140, bestReps: 5, estimatedMax: 163.33 },
    ];

    it("ignores lifts where sessionsBefore is 0 (first session is never a record)", () => {
      const records = [
        { id: "l1", date: "2026-10-01", sessionsBefore: 0 },
        { id: "l2", date: "2026-10-05", sessionsBefore: 3 },
      ];
      const rec = latestRecord(lifts, records);
      expect(rec).toMatchObject({ name: "Incline Press", date: "2026-10-05" });
    });

    it("breaks date ties by selecting the higher estimatedMax", () => {
      const records = [
        { id: "l1", date: "2026-10-10", sessionsBefore: 5 },
        { id: "l3", date: "2026-10-10", sessionsBefore: 5 },
      ];
      const rec = latestRecord(lifts, records);
      expect(rec).toMatchObject({ name: "Squat", estimatedMax: 163.33 });
    });

    it("returns null when no record has sessionsBefore > 0", () => {
      const records = [{ id: "l1", date: "2026-10-01", sessionsBefore: 0 }];
      expect(latestRecord(lifts, records)).toBeNull();
      expect(latestRecord([], [])).toBeNull();
    });
  });
});
