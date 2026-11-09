import { describe, expect, it } from "vitest";
import { liftStory } from "./lift-story";

describe("lift-story edge cases", () => {
  describe("empty and invalid histories", () => {
    it("returns null for empty history", () => {
      expect(liftStory([])).toBeNull();
    });

    it("returns null when all est1rm values are zero or negative", () => {
      expect(
        liftStory([
          { date: "2026-10-01", est1rm: 0 },
          { date: "2026-10-05", est1rm: -10 },
        ]),
      ).toBeNull();
    });
  });

  describe("single session histories", () => {
    it("returns zero change and 1 week for a single logged session", () => {
      const s = liftStory([{ date: "2026-10-15", est1rm: 100 }]);
      expect(s).toEqual({
        change: 0,
        from: 100,
        to: 100,
        weeks: 1,
        sessions: 1,
        record: { value: 100, date: "2026-10-15" },
      });
    });
  });

  describe("all-time record tie-breaking (preserves earliest date)", () => {
    it("preserves the date of the first session that set the record when tied later", () => {
      // 100 reached in June, matched again in October
      const s = liftStory([
        { date: "2026-06-01", est1rm: 100 },
        { date: "2026-07-01", est1rm: 95 },
        { date: "2026-10-01", est1rm: 100 },
      ]);
      // Per CLAUDE.md: "a best reached long ago and only matched lately keeps its own date"
      expect(s?.record).toEqual({ value: 100, date: "2026-06-01" });
    });
  });

  describe("block window filtering and progression/regression", () => {
    it("measures change from the first session within the block window", () => {
      // 12 weeks back from 2026-10-26 is 2026-08-03
      const points = [
        { date: "2026-05-01", est1rm: 120 }, // before block (holds all-time record)
        { date: "2026-08-10", est1rm: 90 }, // first in block
        { date: "2026-09-14", est1rm: 95 },
        { date: "2026-10-26", est1rm: 105 }, // latest in block
      ];
      const s = liftStory(points, 12);
      expect(s).toMatchObject({
        from: 90,
        to: 105,
        change: 15,
        sessions: 3,
        record: { value: 120, date: "2026-05-01" },
      });
    });

    it("calculates negative change when lift regressed over the block", () => {
      const points = [
        { date: "2026-09-01", est1rm: 100 },
        { date: "2026-10-01", est1rm: 92.5 },
      ];
      const s = liftStory(points, 8);
      expect(s?.change).toBe(-7.5);
      expect(s?.from).toBe(100);
      expect(s?.to).toBe(92.5);
    });

    it("respects custom blockWeeks arguments", () => {
      const points = [
        { date: "2026-09-01", est1rm: 80 },
        { date: "2026-10-01", est1rm: 90 },
        { date: "2026-10-20", est1rm: 95 },
      ];
      // 4-week block window from Oct 20 only includes Oct 01 and Oct 20
      const s4 = liftStory(points, 4);
      expect(s4?.sessions).toBe(2);
      expect(s4?.from).toBe(90);
    });

    it("enforces a minimum of 1 week when sessions occur on the same day", () => {
      const points = [
        { date: "2026-10-20", est1rm: 80 },
        { date: "2026-10-20", est1rm: 85 },
      ];
      const s = liftStory(points);
      expect(s?.weeks).toBe(1);
      expect(s?.sessions).toBe(2);
      expect(s?.change).toBe(5);
    });
  });
});
