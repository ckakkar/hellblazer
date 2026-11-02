import type { RecoveryDay, RecoveryWorkout } from "@/lib/native-plugins";
import type { TrainingLoad } from "@/lib/training-load";

/**
 * Recovery on Home: whether today is a day to push, from what the body and
 * the training both say. The body is Apple Health, on the phone: last
 * night's sleep and breathing rate, heart rate variability, resting and
 * walking heart rate, and how hard the heart worked in the last workout.
 * Each is read against the lifter's own last four weeks rather than a
 * population norm, since HRV in particular varies hugely from person to
 * person. The training is Fatty's own log (training-load.ts): how long since
 * the last heavy session, the last three days against the usual, days in a
 * row. Health readings never leave the phone (RecoveryCard).
 *
 * Each signal is good, fair or poor; together they make the call:
 *   - nothing off:                        Ready to push
 *   - one or two off, at most one poor:   Train as planned
 *   - two poor, or three off:             Go lighter
 * A missing usual is no evidence either way: nothing off, but nothing yet
 * read against a usual, is "Learning your usual" (train as planned), not
 * a day for records.
 *
 * ios/App/App/HealthExtras.swift (RecoveryCall) makes the same call for the
 * widget and the watch, hourly in the background: change both together.
 */

export type Tone = "good" | "fair" | "poor";

export type Reading = {
  value: number;
  /** The median of the previous four weeks; null with under a week of them. */
  usual: number | null;
  tone: Tone;
  /** Yesterday's reading, today's not in yet. */
  yesterday?: boolean;
};

export type Verdict = "ready" | "steady" | "easy";

export type SignalKey = "sleep" | "hrv" | "rhr" | "rr" | "walkHr" | "heavy" | "load" | "streak" | "workoutHr";

/** One thing the call rests on, said as the numbers say it. */
export type Signal = { key: SignalKey; tone: Tone; text: string };

export type Recovery = {
  verdict: Verdict;
  /** Nothing's off, but no reading has a usual to be read against yet. */
  learning: boolean;
  headline: string;
  advice: string;
  sleep: Reading | null;
  hrv: Reading | null;
  rhr: Reading | null;
  /** Breaths a minute asleep, last night. */
  rr: Reading | null;
  /** Walking heart rate, today's (else yesterday's) average. */
  walkHr: Reading | null;
  /** What the call rests on, the most telling first. */
  signals: Signal[];
  /** The last two weeks, oldest first, for the trend lines (null where Health has nothing). */
  trend: { dates: string[]; sleepMin: (number | null)[]; hrv: (number | null)[]; rhr: (number | null)[] };
};

export type RecoveryContext = {
  /** From Fatty's log (getTrainingLoad). */
  load?: TrainingLoad | null;
  /** The last week's workouts in Health, with their heart rate (2.9 on). */
  workouts?: RecoveryWorkout[];
  now?: number;
};

/** Fewest earlier days that make a baseline worth comparing against. */
const MIN_BASELINE_DAYS = 7;
const HOUR = 3_600_000;
const TREND_DAYS = 14;

function median(values: number[], min = MIN_BASELINE_DAYS): number | null {
  if (values.length < min) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type DayKey = "sleepMin" | "hrv" | "rhr" | "rr" | "walkHr";

/**
 * Today's reading (else yesterday's: resting heart rate often lands late in
 * the day) and the usual from the days before it.
 */
function latest(days: RecoveryDay[], key: DayKey, allowYesterday: boolean) {
  const last = days.length - 1;
  for (const i of allowYesterday ? [last, last - 1] : [last]) {
    const value = days[i]?.[key];
    if (value == null) continue;
    const before = days
      .slice(0, i)
      .map((d) => d[key])
      .filter((v): v is number => v != null);
    return { value, usual: median(before), yesterday: i !== last };
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

/** Breathing rate asleep: it barely moves night to night, so a rise of one is a lot. */
function rrTone(perMin: number, usual: number | null): Tone {
  if (usual == null) return "good";
  const over = perMin - usual;
  if (over > 1.5) return "poor";
  if (over > 0.8) return "fair";
  return "good";
}

/** Walking heart rate: noisier, so only a clear rise counts. */
function walkTone(bpm: number, usual: number | null): Tone {
  if (usual == null) return "good";
  const over = bpm - usual;
  if (over > 8) return "poor";
  if (over > 5) return "fair";
  return "good";
}

const round = (n: number) => Math.round(n);
const one = (n: number) => Math.round(n * 10) / 10;

function ago(hours: number): string {
  if (hours < 1) return "under an hour ago";
  if (hours < 36) return `${round(hours)} ${round(hours) === 1 ? "hour" : "hours"} ago`;
  const days = round(hours / 24);
  return `${days} days ago`;
}

/** The body's readings as sentences, each with its tone. */
function bodySignals(r: Pick<Recovery, "sleep" | "hrv" | "rhr" | "rr" | "walkHr">): Signal[] {
  const out: Signal[] = [];
  if (r.sleep) {
    const s = r.sleep;
    out.push({
      key: "sleep",
      tone: s.tone,
      text:
        s.usual != null && Math.abs(s.value - s.usual) >= 30
          ? `Slept ${formatSleep(s.value)}, ${s.value < s.usual ? "short of" : "over"} your usual ${formatSleep(s.usual)}`
          : `Slept ${formatSleep(s.value)}`,
    });
  }
  if (r.hrv) {
    const h = r.hrv;
    const pct = h.usual ? round(((h.value - h.usual) / h.usual) * 100) : 0;
    const v = `HRV ${round(h.value)} ms${h.yesterday ? " yesterday" : ""}`;
    out.push({
      key: "hrv",
      tone: h.tone,
      text:
        h.usual == null
          ? `${v}, still learning your usual`
          : Math.abs(pct) < 5
            ? `${v}, right on your usual`
            : `${v}, ${Math.abs(pct)}% ${pct < 0 ? "under" : "over"} your usual ${round(h.usual)}`,
    });
  }
  if (r.rhr) {
    const b = r.rhr;
    const over = b.usual == null ? 0 : round(b.value - b.usual);
    const v = `Resting heart rate ${round(b.value)}${b.yesterday ? " yesterday" : ""}`;
    out.push({
      key: "rhr",
      tone: b.tone,
      text: b.usual == null || over === 0 ? v : `${v}, ${Math.abs(over)} ${over > 0 ? "over" : "under"} your usual`,
    });
  }
  if (r.rr) {
    const b = r.rr;
    const over = b.usual == null ? 0 : one(b.value - b.usual);
    out.push({
      key: "rr",
      tone: b.tone,
      text:
        b.usual == null || Math.abs(over) < 0.5
          ? `Breathing ${one(b.value)} a minute asleep`
          : `Breathing ${one(b.value)} a minute asleep, ${over > 0 ? "up" : "down"} from ${one(b.usual)}`,
    });
  }
  if (r.walkHr && r.walkHr.tone !== "good") {
    const b = r.walkHr;
    out.push({
      key: "walkHr",
      tone: b.tone,
      text: `Walking heart rate ${round(b.value)}${b.yesterday ? " yesterday" : ""}, ${round(b.value - (b.usual ?? b.value))} over your usual`,
    });
  }
  return out;
}

/** What the training says: the last heavy session, the three-day load, days running, the last workout's heart. */
function trainingSignals(ctx: RecoveryContext, now: number): Signal[] {
  const out: Signal[] = [];
  const load = ctx.load;
  if (load?.lastHeavy) {
    const hours = (now - load.lastHeavy.at) / HOUR;
    if (hours >= 0 && hours < 24 * 7) {
      out.push({
        key: "heavy",
        tone: hours < 24 ? "fair" : "good",
        text: `Last heavy session ${ago(hours)}: ${load.lastHeavy.title}, ${load.lastHeavy.sets} sets`,
      });
    }
  }
  if (load && load.usualSets && load.usualSets > 0 && load.recentSets > 0) {
    const ratio = load.recentSets / load.usualSets;
    if (ratio > 1.3) {
      out.push({
        key: "load",
        tone: ratio > 1.6 ? "poor" : "fair",
        text: `${load.recentSets} sets in 3 days, ${one(ratio)}× your usual`,
      });
    }
  }
  if (load && load.streakDays >= 5) {
    out.push({ key: "streak", tone: "fair", text: `${load.streakDays} days in a row of training` });
  }
  // The last strength workout's heart against the ones before it (a run's
  // would sit higher whatever the day).
  const hr = (ctx.workouts ?? [])
    .filter((w) => w.kind === "strength" && w.avgHr != null && w.end <= now)
    .sort((a, b) => b.end - a.end);
  const last = hr[0];
  if (last?.avgHr != null) {
    const hours = (now - last.end) / HOUR;
    const usual = median(
      hr.slice(1).map((w) => w.avgHr!),
      3,
    );
    if (hours < 48 && usual != null) {
      const over = last.avgHr - usual;
      const tone: Tone = hours < 36 && over > 15 ? "poor" : hours < 36 && over > 8 ? "fair" : "good";
      out.push({
        key: "workoutHr",
        tone,
        text:
          Math.abs(over) < 3
            ? `Last workout averaged ${round(last.avgHr)} bpm, as usual`
            : `Last workout averaged ${round(last.avgHr)} bpm, ${Math.abs(round(over))} ${over > 0 ? "over" : "under"} your usual`,
      });
    }
  }
  return out;
}

const TRAINING: ReadonlySet<SignalKey> = new Set(["heavy", "load", "streak", "workoutHr"]);
const RANK: Record<Tone, number> = { poor: 0, fair: 1, good: 2 };

/**
 * The call for today from the days Health returned (oldest first, the last
 * one today), and what Fatty knows of the training. Null when Health has
 * nothing from last night or today to go on.
 */
export function assessRecovery(days: RecoveryDay[], ctx: RecoveryContext = {}): Recovery | null {
  if (days.length === 0) return null;
  const now = ctx.now ?? Date.now();
  const s = latest(days, "sleepMin", false);
  const h = latest(days, "hrv", true);
  const r = latest(days, "rhr", true);
  const b = latest(days, "rr", false);
  const w = latest(days, "walkHr", true);

  const body = {
    sleep: s && { ...s, tone: sleepTone(s.value, s.usual) },
    hrv: h && { ...h, tone: hrvTone(h.value, h.usual) },
    rhr: r && { ...r, tone: rhrTone(r.value, r.usual) },
    rr: b && { ...b, tone: rrTone(b.value, b.usual) },
    walkHr: w && { ...w, tone: walkTone(w.value, w.usual) },
  };
  if (!body.sleep && !body.hrv && !body.rhr && !body.rr) return null;

  const signals = [...bodySignals(body), ...trainingSignals(ctx, now)];
  const poor = signals.filter((x) => x.tone === "poor").length;
  const fair = signals.filter((x) => x.tone === "fair").length;
  const called: Verdict = poor >= 2 || poor + fair >= 3 ? "easy" : poor + fair > 0 ? "steady" : "ready";
  // Ready means read against a usual and found good, not just nothing to say.
  const baselined = [body.sleep, body.hrv, body.rhr, body.rr].some((x) => x != null && x.usual != null);
  const learning = called === "ready" && !baselined;
  const verdict: Verdict = learning ? "steady" : called;

  // Most telling first: what's off, then the rest, body before training.
  const ordered = signals
    .map((sig, i) => ({ sig, i }))
    .sort((x, y) => RANK[x.sig.tone] - RANK[y.sig.tone] || x.i - y.i)
    .map((x) => x.sig);
  const off = ordered.filter((x) => x.tone !== "good");
  const trainingLed = off.length > 0 && off.filter((x) => TRAINING.has(x.key)).length * 2 >= off.length;
  const heavyAgo = signals.find((x) => x.key === "heavy");

  const copy: Record<Verdict, { headline: string; advice: string }> = {
    ready: {
      headline: "Ready to push",
      advice:
        heavyAgo && ctx.load?.lastHeavy && now - ctx.load.lastHeavy.at >= 48 * HOUR
          ? "You've recovered well and the last heavy day is behind you. A good day to go after a record."
          : "You've recovered well. A good day to go after a record.",
    },
    steady: {
      headline: "Train as planned",
      advice: trainingLed
        ? "You're still carrying the last few sessions. Do the work, but save the records for another day."
        : "Not quite at your best. Do the work, but leave the records for another day.",
    },
    easy: {
      headline: "Go lighter today",
      advice: trainingLed
        ? "Your training's run ahead of your recovery. Drop a set per exercise or take 10% off."
        : "Your body's still recovering. Drop a set per exercise or take 10% off.",
    },
  };

  const recent = days.slice(-TREND_DAYS);
  return {
    verdict,
    learning,
    ...(learning
      ? {
          headline: "Learning your usual",
          advice:
            "Fatty needs about a week of nights with your Apple Watch to know your usual. Until then, train as planned.",
        }
      : copy[verdict]),
    ...body,
    signals: ordered,
    trend: {
      dates: recent.map((d) => d.date),
      sleepMin: recent.map((d) => d.sleepMin ?? null),
      hrv: recent.map((d) => d.hrv ?? null),
      rhr: recent.map((d) => d.rhr ?? null),
    },
  };
}

/** "7h 42m". */
export function formatSleep(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
