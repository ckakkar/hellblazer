import { describe, expect, it } from "vitest";
import {
  blockDate,
  countedWorkouts,
  countInWeek,
  inWeek,
  pausedDays,
  readPauses,
  weekDays,
} from "./program-week";
import { STALE_CLOCK_MS } from "./workout-clock";

const row = (date: string, created_at = `${date}T12:00:00Z`) => ({ date, created_at });

describe("program-week edge cases", () => {
  describe("year end and ISO week boundaries", () => {
    // 2026 is an ISO 53-week year. Week 53 starts on Monday 2026-12-28 and runs through Sunday 2027-01-03.
    const week53 = { weekStart: "2026-12-28", pauses: [], restartedAt: null };

    it("includes rows on both sides of the New Year boundary in the same week", () => {
      expect(inWeek(row("2026-12-28"), week53)).toBe(true);
      expect(inWeek(row("2026-12-31"), week53)).toBe(true);
      expect(inWeek(row("2027-01-01"), week53)).toBe(true);
      expect(inWeek(row("2027-01-03"), week53)).toBe(true);
    });

    it("excludes rows from the prior year's week 52 and the next year's week 1", () => {
      expect(inWeek(row("2026-12-27"), week53)).toBe(false);
      expect(inWeek(row("2027-01-04"), week53)).toBe(false);
    });

    it("correctly counts all week 53 workouts across the year boundary", () => {
      const rows = [
        row("2026-12-27"), // week 52
        row("2026-12-28"), // week 53
        row("2026-12-30"), // week 53
        row("2027-01-01"), // week 53
        row("2027-01-03"), // week 53
        row("2027-01-04"), // week 1 of 2027
      ];
      expect(countInWeek(rows, week53)).toBe(4);
    });

    it("handles week spanning leap day in February 2028", () => {
      const leapWeek = { weekStart: "2028-02-28", pauses: [], restartedAt: null };
      expect(inWeek(row("2028-02-28"), leapWeek)).toBe(true);
      expect(inWeek(row("2028-02-29"), leapWeek)).toBe(true);
      expect(inWeek(row("2028-03-05"), leapWeek)).toBe(true);
      expect(inWeek(row("2028-03-06"), leapWeek)).toBe(false);
    });
  });

  describe("pauses and stopped calendar", () => {
    it("shifts a workout on the exact day the pause started", () => {
      // Paused on 2026-10-14 for 5 days: shifts anything <= 2026-10-14 by 5 days
      const pauses = [{ at: "2026-10-14", days: 5 }];
      expect(blockDate("2026-10-14", pauses)).toBe("2026-10-19");
    });

    it("does not shift a workout on the resume day", () => {
      // Resume day after 5 days from Oct 14 is Oct 19
      const pauses = [{ at: "2026-10-14", days: 5 }];
      expect(blockDate("2026-10-19", pauses)).toBe("2026-10-19");
    });

    it("handles multiple pauses regardless of their array order", () => {
      const pausesForward = [
        { at: "2026-10-05", days: 3 },
        { at: "2026-10-15", days: 4 },
      ];
      const pausesReversed = [
        { at: "2026-10-15", days: 4 },
        { at: "2026-10-05", days: 3 },
      ];
      // Date before both pauses: gets shifted by 3 + 4 = 7 days
      expect(blockDate("2026-10-01", pausesForward)).toBe("2026-10-08");
      expect(blockDate("2026-10-01", pausesReversed)).toBe("2026-10-08");
      // Date between the two pauses: gets shifted only by the second pause (4 days)
      expect(blockDate("2026-10-10", pausesForward)).toBe("2026-10-14");
      expect(blockDate("2026-10-10", pausesReversed)).toBe("2026-10-14");
    });

    it("computes pausedDays total accurately", () => {
      expect(pausedDays([])).toBe(0);
      expect(
        pausedDays([
          { at: "2026-10-01", days: 2 },
          { at: "2026-10-10", days: 5 },
        ]),
      ).toBe(7);
    });
  });

  describe("restarts and precision timestamps", () => {
    const week = { weekStart: "2026-11-02", pauses: [], restartedAt: "2026-11-02T14:30:00.000Z" };

    it("excludes workouts created 1 ms before the restart timestamp", () => {
      expect(inWeek({ date: "2026-11-02", created_at: "2026-11-02T14:29:59.999Z" }, week)).toBe(false);
    });

    it("includes workouts created at or after the exact restart timestamp", () => {
      expect(inWeek({ date: "2026-11-02", created_at: "2026-11-02T14:30:00.000Z" }, week)).toBe(true);
      expect(inWeek({ date: "2026-11-02", created_at: "2026-11-02T15:00:00.000Z" }, week)).toBe(true);
    });
  });

  describe("readPauses defensive validation", () => {
    it("handles non-array and empty inputs safely", () => {
      expect(readPauses(null)).toEqual([]);
      expect(readPauses(undefined)).toEqual([]);
      expect(readPauses("")).toEqual([]);
      expect(readPauses({})).toEqual([]);
      expect(readPauses([])).toEqual([]);
    });

    it("filters out invalid dates, non-integers, and non-positive days", () => {
      expect(
        readPauses([
          { at: "2026-10-10", days: 3 },
          { at: "not-a-date", days: 2 },
          { at: "2026-10-11", days: -1 },
          { at: "2026-10-12", days: 0 },
          { at: "2026-10-13", days: 2.5 },
          { at: "2026-10-14", days: NaN },
          { at: "2026-10-15", days: Infinity },
          null,
          undefined,
        ]),
      ).toEqual([{ at: "2026-10-10", days: 3 }]);
    });
  });

  describe("weekDays status, extra workouts, and next day selection", () => {
    const week = { weekStart: "2026-11-02", pauses: [], restartedAt: null };
    const days = ["day-1", "day-2", "day-3", "day-4"];
    const entry = (date: string, day: string | null, at = `${date}T10:00:00Z`) => ({
      date,
      created_at: at,
      program_day_id: day,
    });

    it("handles an empty program days array", () => {
      expect(weekDays([], [], [], week)).toEqual({
        status: [],
        extra: 0,
        next: 0,
      });
    });

    it("offers next open day when days are performed out of order", () => {
      // Did Day 3 first, then Day 2
      const workouts = [entry("2026-11-02", "day-3"), entry("2026-11-03", "day-2")];
      const res = weekDays(days, workouts, [], week);
      expect(res.status).toEqual([null, "done", "done", null]);
      expect(res.extra).toBe(0);
      expect(res.next).toBe(0); // Day 1 is first open
    });

    it("handles skipped day followed by workout for the same day (done overrides skip)", () => {
      const skips = [entry("2026-11-02", "day-1", "2026-11-02T08:00:00Z")];
      const workouts = [entry("2026-11-02", "day-1", "2026-11-02T18:00:00Z")];
      const res = weekDays(days, workouts, skips, week);
      expect(res.status).toEqual(["done", null, null, null]);
      expect(res.next).toBe(1);
    });

    it("keeps status as done when a skip is logged after the workout", () => {
      const workouts = [entry("2026-11-02", "day-1", "2026-11-02T08:00:00Z")];
      const skips = [entry("2026-11-02", "day-1", "2026-11-02T18:00:00Z")];
      const res = weekDays(days, workouts, skips, week);
      expect(res.status).toEqual(["done", null, null, null]);
    });

    it("counts repeated workouts on the same day as extra", () => {
      const workouts = [
        entry("2026-11-02", "day-1", "2026-11-02T08:00:00Z"),
        entry("2026-11-03", "day-1", "2026-11-03T08:00:00Z"),
        entry("2026-11-04", "day-1", "2026-11-04T08:00:00Z"),
      ];
      const res = weekDays(days, workouts, [], week);
      expect(res.status).toEqual(["done", null, null, null]);
      expect(res.extra).toBe(2);
      expect(res.next).toBe(1);
    });

    it("wraps next to 0 when every day is completed or skipped", () => {
      const allDone = days.map((d, i) => entry(`2026-11-0${2 + i}`, d));
      expect(weekDays(days, allDone, [], week).next).toBe(0);

      const allSkipped = days.map((d, i) => entry(`2026-11-0${2 + i}`, d));
      expect(weekDays(days, [], allSkipped, week).next).toBe(0);
    });

    it("places unplaced workouts into open slots and counts overflow as extra", () => {
      const unplaced = [
        entry("2026-11-02", null, "2026-11-02T08:00:00Z"),
        entry("2026-11-03", null, "2026-11-03T08:00:00Z"),
        entry("2026-11-04", "day-2", "2026-11-04T08:00:00Z"),
        entry("2026-11-05", null, "2026-11-05T08:00:00Z"),
        entry("2026-11-06", null, "2026-11-06T08:00:00Z"),
        entry("2026-11-07", null, "2026-11-07T08:00:00Z"), // 5 unplaced for 3 remaining slots -> 2 extra
      ];
      const res = weekDays(days, unplaced, [], week);
      expect(res.status).toEqual(["done", "done", "done", "done"]);
      expect(res.extra).toBe(2);
      expect(res.next).toBe(0);
    });
  });

  describe("countedWorkouts filter", () => {
    it("generates correct PostgREST or filter with 6-hour stale clock", () => {
      const now = Date.parse("2026-11-09T18:00:00.000Z");
      const filter = countedWorkouts(now);
      const staleTime = new Date(now - STALE_CLOCK_MS).toISOString();
      expect(filter).toBe(`finished_at.not.is.null,created_at.lt."${staleTime}"`);
    });
  });
});
