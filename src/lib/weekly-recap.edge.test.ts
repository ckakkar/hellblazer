import { describe, expect, it } from "vitest";
import { recapMessage, recapWeek } from "./weekly-recap";

describe("weekly-recap edge cases", () => {
  describe("recapWeek triggering schedule and cutoffs", () => {
    // 2026-10-18 is a Sunday; Monday was 2026-10-12.
    // 2026-10-19 is a Monday; Monday of prior week was 2026-10-12.
    it("activates on Sunday exactly at hour 12 (noon)", () => {
      expect(recapWeek("2026-10-18", 11)).toBeNull();
      expect(recapWeek("2026-10-18", 12)).toBe("2026-10-12");
      expect(recapWeek("2026-10-18", 23)).toBe("2026-10-12");
    });

    it("activates on Monday before noon and deactivates at hour 12", () => {
      expect(recapWeek("2026-10-19", 0)).toBe("2026-10-12");
      expect(recapWeek("2026-10-19", 11)).toBe("2026-10-12");
      expect(recapWeek("2026-10-19", 12)).toBeNull();
      expect(recapWeek("2026-10-19", 18)).toBeNull();
    });

    it("returns null for all midweek days (Tue-Sat)", () => {
      expect(recapWeek("2026-10-20", 14)).toBeNull(); // Tue
      expect(recapWeek("2026-10-21", 14)).toBeNull(); // Wed
      expect(recapWeek("2026-10-22", 14)).toBeNull(); // Thu
      expect(recapWeek("2026-10-23", 14)).toBeNull(); // Fri
      expect(recapWeek("2026-10-24", 14)).toBeNull(); // Sat
    });

    it("handles year end transition (2026-12-28 to 2027-01-04)", () => {
      // 2027-01-03 is Sunday. Local hour 15 should recap the week that started Monday 2026-12-28.
      expect(recapWeek("2027-01-03", 15)).toBe("2026-12-28");
      // 2027-01-04 is Monday morning (hour 8), should still recap 2026-12-28.
      expect(recapWeek("2027-01-04", 8)).toBe("2026-12-28");
      // 2027-01-04 at hour 13 should return null (week has ended).
      expect(recapWeek("2027-01-04", 13)).toBeNull();
    });
  });

  describe("recapMessage copy and grammar edge cases", () => {
    it("handles zero workouts logged", () => {
      const msg = recapMessage({
        sessions: 0,
        planned: 4,
        sets: 0,
        records: [],
        weakest: null,
      });
      expect(msg.title).toBe("Your week in Fatty");
      expect(msg.body).toBe("No workouts logged this week. A new week starts tomorrow.");
    });

    it("handles single workout and single set singular forms", () => {
      const msg = recapMessage({
        sessions: 1,
        planned: null,
        sets: 1,
        records: ["Overhead Press"],
        weakest: { label: "Triceps", sets: 1 },
      });
      expect(msg.title).toBe("1 workout this week");
      expect(msg.body).toBe(
        "1 working set. New best on Overhead Press. Triceps is lowest at 1 set.",
      );
    });

    it("formats 0 sets on a weak point correctly", () => {
      const msg = recapMessage({
        sessions: 2,
        planned: 3,
        sets: 15,
        records: [],
        weakest: { label: "Side delts", sets: 0 },
      });
      expect(msg.title).toBe("2 of 3 workouts this week");
      expect(msg.body).toBe("15 working sets. Side delts is lowest at 0 sets.");
    });

    it("formats 2 records with 'and'", () => {
      const msg = recapMessage({
        sessions: 3,
        planned: 3,
        sets: 30,
        records: ["Bench Press", "Squat"],
        weakest: null,
      });
      expect(msg.body).toContain("New bests on Bench Press and Squat. Every weak point hit its sets.");
    });

    it("formats 3 or more records with '... and N more'", () => {
      const msg = recapMessage({
        sessions: 4,
        planned: 4,
        sets: 45,
        records: ["Bench Press", "Squat", "Deadlift", "Barbell Row"],
        weakest: null,
      });
      expect(msg.body).toContain("New bests on Bench Press, Squat and 2 more. Every weak point hit its sets.");
    });
  });
});
