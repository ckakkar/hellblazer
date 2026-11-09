import { describe, expect, it } from "vitest";
import {
  computeTrainingLoad,
  isHeavy,
  trainingLoadFromSummaries,
  type LoadSession,
} from "./training-load";
import { STALE_CLOCK_MS } from "./workout-clock";

const DAY = 24 * 3_600_000;
const NOW = Date.parse("2026-11-09T18:00:00.000Z");

function makeSession(daysAgo: number, sets: number, volume: number, title = "Session"): LoadSession {
  const at = NOW - daysAgo * DAY;
  return { at, date: new Date(at).toISOString().slice(0, 10), title, sets, volume };
}

describe("training-load edge cases", () => {
  describe("isHeavy determination", () => {
    it("returns false if working sets < 8 regardless of volume", () => {
      const s = makeSession(1, 7, 50_000);
      const all = [s, makeSession(5, 10, 5_000), makeSession(10, 10, 5_000), makeSession(15, 10, 5_000)];
      expect(isHeavy(s, all)).toBe(false);
    });

    it("requires 12 working sets when there are fewer than 4 baseline sessions", () => {
      const s11 = makeSession(1, 11, 20_000);
      const s12 = makeSession(1, 12, 5_000);
      const fewSessions = [s11, makeSession(5, 10, 5_000)];
      expect(isHeavy(s11, fewSessions)).toBe(false);
      expect(isHeavy(s12, fewSessions)).toBe(true);
    });

    it("requires volume to exceed 1.1x median when 4+ baseline sessions exist", () => {
      // 4 baseline sessions with volumes: 1000, 2000, 2000, 3000 -> median 2000. 1.1x = 2200.
      const baseline = [
        makeSession(5, 10, 1000),
        makeSession(10, 10, 2000),
        makeSession(15, 10, 2000),
        makeSession(20, 10, 3000),
      ];
      const underHeavy = makeSession(1, 10, 2199);
      const atHeavy = makeSession(1, 10, 2200);
      expect(isHeavy(underHeavy, [...baseline, underHeavy])).toBe(false);
      expect(isHeavy(atHeavy, [...baseline, atHeavy])).toBe(true);
    });
  });

  describe("computeTrainingLoad baselines and recent sets", () => {
    it("handles empty session history cleanly", () => {
      const load = computeTrainingLoad([], NOW, "2026-11-09");
      expect(load).toEqual({
        lastHeavy: null,
        recentSets: 0,
        usualSets: null,
        streakDays: 0,
      });
    });

    it("filters out sessions with 0 sets or future timestamps", () => {
      const zeroSets = makeSession(1, 0, 0);
      const futureSession: LoadSession = {
        at: NOW + 3_600_000,
        date: "2026-11-09",
        title: "Future",
        sets: 15,
        volume: 10_000,
      };
      const load = computeTrainingLoad([zeroSets, futureSession], NOW, "2026-11-09");
      expect(load.recentSets).toBe(0);
      expect(load.lastHeavy).toBeNull();
    });

    it("returns usualSets as null with under 4 sessions in the 28-day baseline window", () => {
      const sessions = [
        makeSession(1, 15, 8000), // recent window (< 3 days)
        makeSession(5, 15, 8000), // baseline 1
        makeSession(10, 15, 8000), // baseline 2
        makeSession(15, 15, 8000), // baseline 3
      ];
      const load = computeTrainingLoad(sessions, NOW, "2026-11-09");
      expect(load.recentSets).toBe(15);
      // Only 3 sessions in baseline window (>= 3 days and < 31 days) -> null
      expect(load.usualSets).toBeNull();
    });

    it("calculates usualSets accurately when 4+ baseline sessions exist", () => {
      const sessions = [
        makeSession(1, 15, 8000),
        // 4 baseline sessions: each has 14 sets -> 56 sets total across 28 days = 2 sets/day * 3 days = 6 sets
        makeSession(5, 14, 8000),
        makeSession(10, 14, 8000),
        makeSession(15, 14, 8000),
        makeSession(20, 14, 8000),
      ];
      const load = computeTrainingLoad(sessions, NOW, "2026-11-09");
      expect(load.usualSets).toBe(6);
    });
  });

  describe("streakDays daily continuity", () => {
    it("counts streak starting from today when today has a session", () => {
      const today = "2026-11-09";
      const sessions = [
        { at: NOW, date: "2026-11-09", title: "S1", sets: 10, volume: 5000 },
        { at: NOW - DAY, date: "2026-11-08", title: "S2", sets: 10, volume: 5000 },
        { at: NOW - 2 * DAY, date: "2026-11-07", title: "S3", sets: 10, volume: 5000 },
      ];
      expect(computeTrainingLoad(sessions, NOW, today).streakDays).toBe(3);
    });

    it("counts streak starting from yesterday when today has not been trained yet", () => {
      const today = "2026-11-09";
      const sessions = [
        { at: NOW - DAY, date: "2026-11-08", title: "S1", sets: 10, volume: 5000 },
        { at: NOW - 2 * DAY, date: "2026-11-07", title: "S2", sets: 10, volume: 5000 },
      ];
      expect(computeTrainingLoad(sessions, NOW, today).streakDays).toBe(2);
    });

    it("returns 0 when neither today nor yesterday has a session", () => {
      const today = "2026-11-09";
      const sessions = [{ at: NOW - 2 * DAY, date: "2026-11-07", title: "S1", sets: 10, volume: 5000 }];
      expect(computeTrainingLoad(sessions, NOW, today).streakDays).toBe(0);
    });
  });

  describe("trainingLoadFromSummaries stale workout handling", () => {
    it("ignores unfinished workouts newer than STALE_CLOCK_MS", () => {
      const freshOpen = {
        session_date: "2026-11-09",
        created_at: new Date(NOW - 30 * 60_000).toISOString(), // 30 min ago
        finished_at: null,
        duration_min: 60,
        title: "Live Workout",
        working_sets: 10,
        total_volume: 5000,
      };
      const load = trainingLoadFromSummaries([freshOpen], "2026-11-09", NOW);
      expect(load.recentSets).toBe(0);
    });

    it("includes unfinished workouts older than STALE_CLOCK_MS (forgotten finish)", () => {
      const staleOpen = {
        session_date: "2026-11-09",
        created_at: new Date(NOW - (STALE_CLOCK_MS + 3600_000)).toISOString(), // 7h ago
        finished_at: null,
        duration_min: 60,
        title: "Stale Workout",
        working_sets: 10,
        total_volume: 5000,
      };
      const load = trainingLoadFromSummaries([staleOpen], "2026-11-09", NOW);
      expect(load.recentSets).toBe(10);
    });
  });
});
