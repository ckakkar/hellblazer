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
    expect(r.verdict).toBe("ready");
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
