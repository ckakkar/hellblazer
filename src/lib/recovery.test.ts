import { describe, expect, it } from "vitest";
import type { RecoveryDay } from "@/lib/native-plugins";
import { assessRecovery, formatSleep } from "./recovery";

/** Four weeks of a steady lifter: 7.5h sleep, HRV 60, resting 52; then today. */
function weeks(today: Partial<RecoveryDay>, usual: Partial<RecoveryDay> = {}): RecoveryDay[] {
  const days: RecoveryDay[] = Array.from({ length: 28 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    sleepMin: 450,
    hrv: 60,
    rhr: 52,
    ...usual,
  }));
  return [...days, { date: "2026-09-29", ...today }];
}

describe("recovery", () => {
  it("says push on a normal morning", () => {
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 62, rhr: 51 }))!;
    expect(r.verdict).toBe("ready");
    expect(r.hrv).toMatchObject({ value: 62, usual: 60, tone: "good" });
  });

  it("holds back the PRs after one short night", () => {
    expect(assessRecovery(weeks({ sleepMin: 330, hrv: 61, rhr: 52 }))!.verdict).toBe("steady");
  });

  it("says go lighter when two things are clearly off", () => {
    expect(assessRecovery(weeks({ sleepMin: 330, hrv: 48, rhr: 52 }))!.verdict).toBe("easy");
    expect(assessRecovery(weeks({ sleepMin: 400, hrv: 55, rhr: 55 }))!.verdict).toBe("easy");
  });

  it("reads HRV against the lifter's own usual, not a population norm", () => {
    // 35 ms is low for most people, but normal for this lifter.
    expect(assessRecovery(weeks({ sleepMin: 450, hrv: 35, rhr: 52 }, { hrv: 34 }))!.verdict).toBe("ready");
  });

  it("uses yesterday's resting heart rate when today's isn't in yet", () => {
    const days = weeks({ sleepMin: 450, hrv: 60 });
    days[days.length - 2].rhr = 60;
    expect(assessRecovery(days)!.rhr).toMatchObject({ value: 60, tone: "poor" });
  });

  it("doesn't compare against less than a week of history", () => {
    const days: RecoveryDay[] = [
      { date: "2026-09-27", hrv: 90 },
      { date: "2026-09-28", hrv: 40, sleepMin: 470 },
    ];
    const r = assessRecovery(days)!;
    expect(r.hrv).toMatchObject({ usual: null, tone: "good" });
    // Nothing read against a usual is no evidence for a record.
    expect(r).toMatchObject({ verdict: "steady", learning: true, headline: "Learning your usual" });
  });

  it("won't call one reading with no usual a day to push", () => {
    const r = assessRecovery([{ date: "2026-09-28", hrv: 55 }])!;
    expect(r).toMatchObject({ verdict: "steady", learning: true });
    expect(r.advice).toMatch(/train as planned/);
    expect(r.signals[0].text).toBe("HRV 55 ms, still learning your usual");
  });

  it("says when a reading is yesterday's", () => {
    const r = assessRecovery([
      { date: "2026-09-27", hrv: 55, rhr: 52 },
      { date: "2026-09-28", sleepMin: 450 },
    ])!;
    expect(r.signals.map((x) => x.text)).toEqual(
      expect.arrayContaining(["HRV 55 ms yesterday, still learning your usual", "Resting heart rate 52 yesterday"]),
    );
  });

  it("still learning, but something's off, is said as it is", () => {
    const r = assessRecovery([{ date: "2026-09-28", hrv: 55, sleepMin: 5 * 60 }])!;
    expect(r).toMatchObject({ learning: false });
    expect(r.verdict).not.toBe("ready");
  });

  it("has nothing to say without a reading from today", () => {
    expect(assessRecovery([])).toBeNull();
    expect(assessRecovery([{ date: "2026-09-27" }, { date: "2026-09-28" }])).toBeNull();
  });

  it("writes sleep as hours and minutes", () => {
    expect(formatSleep(462)).toBe("7h 42m");
    expect(formatSleep(360)).toBe("6h 00m");
  });
});

describe("recovery with training and the rest of Health", () => {
  const now = Date.parse("2026-09-29T08:00:00Z");
  const load = (hoursAgo: number, recentSets = 20, usualSets = 20) => ({
    lastHeavy: { at: now - hoursAgo * 3_600_000, title: "Lower (Heavy)", sets: 24 },
    recentSets,
    usualSets,
    streakDays: 2,
  });

  it("holds the records the morning after a heavy session", () => {
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 62, rhr: 51 }), { load: load(14), now })!;
    expect(r.verdict).toBe("steady");
    expect(r.signals[0]).toMatchObject({ key: "heavy", tone: "fair" });
    expect(r.signals[0].text).toBe("Last heavy session 14 hours ago: Lower (Heavy), 24 sets");
  });

  it("is ready once the heavy day is two days back", () => {
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 62, rhr: 51 }), { load: load(50), now })!;
    expect(r.verdict).toBe("ready");
  });

  it("goes lighter on a training spike and a body that shows it", () => {
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 50, rhr: 51 }), { load: load(30, 60, 30), now })!;
    expect(r.verdict).toBe("easy");
    expect(r.signals.map((s) => s.key)).toEqual(expect.arrayContaining(["hrv", "load"]));
  });

  it("reads breathing rate asleep against its usual", () => {
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 61, rhr: 52, rr: 16.5 }, { rr: 14.5 }), { now })!;
    expect(r.rr).toMatchObject({ value: 16.5, usual: 14.5, tone: "poor" });
    expect(r.verdict).toBe("steady");
  });

  it("weighs the last workout's heart rate against the ones before", () => {
    const hour = 3_600_000;
    const workouts = [
      { start: now - 20 * hour, end: now - 19 * hour, kind: "strength", avgHr: 142 },
      ...[3, 4, 5, 6].map((d) => ({ start: now - d * 24 * hour, end: now - d * 24 * hour + hour, kind: "strength", avgHr: 120 })),
    ];
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 61, rhr: 52 }), { workouts, now })!;
    expect(r.signals.find((s) => s.key === "workoutHr")).toMatchObject({ tone: "poor" });
  });

  it("keeps two weeks for the trend lines", () => {
    const r = assessRecovery(weeks({ sleepMin: 460, hrv: 61, rhr: 52 }))!;
    expect(r.trend.dates).toHaveLength(14);
    expect(r.trend.hrv.at(-1)).toBe(61);
  });
});
