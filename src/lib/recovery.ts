import type { RecoveryDay } from "@/lib/native-plugins";

/**
 * Recovery on Home: last night's sleep, today's heart rate variability and
 * resting heart rate, each read against the lifter's own last four weeks
 * rather than a population norm, since HRV in particular varies hugely from
 * person to person. The readings come from Apple Health on the phone and
 * never leave it (RecoveryCard).
 *
 * Each reading is good, fair or poor; together they make the call:
 *   - nothing off:                       Ready to push
 *   - one reading off, or two only fair: Train as planned
 *   - two poor, or three off:            Go lighter
 */

export type Tone = "good" | "fair" | "poor";

export type Reading = {
  value: number;
  /** The median of the previous four weeks; null with under a week of them. */
  usual: number | null;
  tone: Tone;
};

export type Verdict = "ready" | "steady" | "easy";

export type Recovery = {
  verdict: Verdict;
  headline: string;
  advice: string;
  sleep: Reading | null;
  hrv: Reading | null;
  rhr: Reading | null;
};

/** Fewest earlier days that make a baseline worth comparing against. */
const MIN_BASELINE_DAYS = 7;

function median(values: number[]): number | null {
  if (values.length < MIN_BASELINE_DAYS) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Today's reading (else yesterday's: resting heart rate often lands late in
 * the day) and the usual from the days before it.
 */
function latest(days: RecoveryDay[], key: "sleepMin" | "hrv" | "rhr", allowYesterday: boolean) {
  const last = days.length - 1;
  for (const i of allowYesterday ? [last, last - 1] : [last]) {
    const value = days[i]?.[key];
    if (value == null) continue;
    const before = days
      .slice(0, i)
      .map((d) => d[key])
      .filter((v): v is number => v != null);
    return { value, usual: median(before) };
  }
  return null;
}

/** Sleep: seven hours is the floor for recovery; well short of usual counts too. */
function sleepTone(minutes: number, usual: number | null): Tone {
  if (minutes < 6 * 60 || (usual != null && minutes < usual - 90)) return "poor";
  if (minutes < 7 * 60 || (usual != null && minutes < usual - 45)) return "fair";
  return "good";
}

/** HRV: a drop well under your usual is the body still under load. */
function hrvTone(ms: number, usual: number | null): Tone {
  if (usual == null) return "good";
  const ratio = ms / usual;
  if (ratio < 0.85) return "poor";
  if (ratio < 0.95) return "fair";
  return "good";
}

/** Resting heart rate: a few beats over usual is fatigue (or a cold coming). */
function rhrTone(bpm: number, usual: number | null): Tone {
  if (usual == null) return "good";
  const over = bpm - usual;
  if (over > 5) return "poor";
  if (over > 2) return "fair";
  return "good";
}

/**
 * The call for today from the days Health returned (oldest first, the last
 * one today). Null when there's nothing from last night or today to go on.
 */
export function assessRecovery(days: RecoveryDay[]): Recovery | null {
  if (days.length === 0) return null;
  const s = latest(days, "sleepMin", false);
  const h = latest(days, "hrv", true);
  const r = latest(days, "rhr", true);

  const sleep = s && { ...s, tone: sleepTone(s.value, s.usual) };
  const hrv = h && { ...h, tone: hrvTone(h.value, h.usual) };
  const rhr = r && { ...r, tone: rhrTone(r.value, r.usual) };
  const readings = [sleep, hrv, rhr].filter((x): x is Reading => x != null);
  if (readings.length === 0) return null;

  const poor = readings.filter((x) => x.tone === "poor").length;
  const fair = readings.filter((x) => x.tone === "fair").length;
  const verdict: Verdict =
    poor >= 2 || poor + fair >= 3 ? "easy" : poor + fair > 0 ? "steady" : "ready";

  const copy: Record<Verdict, { headline: string; advice: string }> = {
    ready: {
      headline: "Ready to push",
      advice: "You've recovered well. A good day to go after a PR.",
    },
    steady: {
      headline: "Train as planned",
      advice: "Not quite at your best. Do the work, but leave the PRs for another day.",
    },
    easy: {
      headline: "Go lighter today",
      advice: "Your body's still recovering. Drop a set per exercise or take 10% off.",
    },
  };
  return { verdict, ...copy[verdict], sleep, hrv, rhr };
}

/** "7h 42m". */
export function formatSleep(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
