import { describe, expect, it } from "vitest";
import type { RecoveryDay } from "./native-plugins";
import { assessRecovery, formatSleep } from "./recovery";

function steadyDays(count: number, todayOverride: Partial<RecoveryDay> = {}): RecoveryDay[] {
  const days: RecoveryDay[] = Array.from({ length: count }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    sleepMin: 480, // 8h
    hrv: 65,
    rhr: 50,
    rr: 14,
    walkHr: 90,
  }));
  if (count > 0) {
    days[days.length - 1] = { ...days[days.length - 1], ...todayOverride };
  }
  return days;
}

describe("recovery edge cases", () => {
  describe("history length and 'Learning your usual'", () => {
    it("returns null when days array is completely empty", () => {
      expect(assessRecovery([])).toBeNull();
    });

    it("returns null when days have dates but no biometric readings", () => {
      expect(assessRecovery([{ date: "2026-11-08" }, { date: "2026-11-09" }])).toBeNull();
    });

    it("requires at least 7 days of baseline before establishing a usual", () => {
      // 6 days of steady readings (below 7-day MIN_BASELINE_DAYS)
      const sixDays = steadyDays(6);
      const res = assessRecovery(sixDays);
      expect(res).not.toBeNull();
      expect(res?.learning).toBe(true);
      expect(res?.verdict).toBe("steady");
      expect(res?.headline).toBe("Learning your usual");
      expect(res?.hrv?.usual).toBeNull();
      expect(res?.sleep?.usual).toBeNull();
      expect(res?.rhr?.usual).toBeNull();
    });

    it("establishes baselines and allows 'Ready to push' at 7+ days", () => {
      // 7 baseline days + 1 today = 8 days
      const eightDays = steadyDays(8);
      const res = assessRecovery(eightDays);
      expect(res).not.toBeNull();
      expect(res?.learning).toBe(false);
      expect(res?.verdict).toBe("ready");
      expect(res?.headline).toBe("Ready to push");
      expect(res?.hrv?.usual).toBe(65);
    });

    it("flags poor sleep even during the learning period", () => {
      // 3 days of data, but last night was 4 hours of sleep (< 6h = poor)
      const days = steadyDays(3, { sleepMin: 240 });
      const res = assessRecovery(days);
      expect(res?.learning).toBe(false);
      expect(res?.sleep?.tone).toBe("poor");
      expect(res?.verdict).toBe("steady");
      expect(res?.headline).toBe("Train as planned");
    });
  });

  describe("sleep tone cutoffs", () => {
    it("classifies sleep under 6 hours (360m) as poor", () => {
      const days = steadyDays(10, { sleepMin: 359 });
      expect(assessRecovery(days)?.sleep?.tone).toBe("poor");
    });

    it("classifies sleep between 6 and 7 hours as fair when close to usual", () => {
      // With usual 480m (8h): poor is < 390m (usual - 90). Fair is between 390m and 435m.
      const days = steadyDays(10, { sleepMin: 400 });
      expect(assessRecovery(days)?.sleep?.tone).toBe("fair");
      const days2 = steadyDays(10, { sleepMin: 420 });
      expect(assessRecovery(days2)?.sleep?.tone).toBe("fair");
    });

    it("classifies sleep of 7+ hours as good when close to usual", () => {
      const days = steadyDays(10, { sleepMin: 420 });
      expect(assessRecovery(days)?.sleep?.tone).toBe("fair"); // 420 is < 480 - 45 (435) -> fair against usual
      const daysGood = steadyDays(10, { sleepMin: 480 });
      expect(assessRecovery(daysGood)?.sleep?.tone).toBe("good");
    });
  });

  describe("verdict aggregation: ready vs steady vs easy", () => {
    it("calls 'easy' (Go lighter today) when 2 or more signals are poor", () => {
      // Poor sleep (<6h) and poor HRV (<0.85 of 65 = 55.25)
      const days = steadyDays(10, { sleepMin: 300, hrv: 45 });
      const res = assessRecovery(days);
      expect(res?.verdict).toBe("easy");
      expect(res?.headline).toBe("Go lighter today");
    });

    it("calls 'easy' when 3 or more signals are off (fair or poor)", () => {
      // Fair sleep (<7h), fair HRV (<0.95 of 65 = 61.75), fair RHR (>2 over 50 = 53)
      const days = steadyDays(10, { sleepMin: 400, hrv: 60, rhr: 53 });
      const res = assessRecovery(days);
      expect(res?.verdict).toBe("easy");
    });

    it("calls 'steady' (Train as planned) when 1 or 2 signals are off", () => {
      const days = steadyDays(10, { sleepMin: 400 }); // only sleep is fair
      const res = assessRecovery(days);
      expect(res?.verdict).toBe("steady");
      expect(res?.headline).toBe("Train as planned");
    });
  });

  describe("formatSleep string representation", () => {
    it("formats 0 minutes as 0h 00m", () => {
      expect(formatSleep(0)).toBe("0h 00m");
    });

    it("pads minutes under 10", () => {
      expect(formatSleep(425)).toBe("7h 05m");
      expect(formatSleep(61)).toBe("1h 01m");
    });

    it("rounds fractional minutes cleanly", () => {
      expect(formatSleep(450.4)).toBe("7h 30m");
      expect(formatSleep(450.6)).toBe("7h 31m");
    });
  });
});
