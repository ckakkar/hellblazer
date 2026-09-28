/**
 * What an Apple Watch's heart rate says about a finished workout: the
 * exercise that pushed hardest, how fast the heart came back down between
 * sets, the rests cut short, and the session's load. Worked out on the
 * iPhone from Health's readings (ios/App/App/HeartInsights.swift) and the
 * times the sets were logged; nothing here leaves the phone.
 *
 * Wrist heart rate lags effort and jumps while gripping a bar, so readings
 * are smoothed, a set's peak is looked for in the half minute after it was
 * logged, and nothing is claimed per rep.
 */

export type HeartSample = {
  /** Epoch ms. */
  t: number;
  bpm: number;
};

export type TimedSet = {
  /** When it was logged, epoch ms: about when the set ended. */
  at: number;
  /** The session exercise it belongs to. */
  key: string;
  exercise: string;
  warmup: boolean;
};

export type ExerciseHeart = {
  key: string;
  name: string;
  /** Its highest set peak. */
  peak: number;
  /** Working sets placed on the heart-rate trace. */
  sets: number;
};

export type HeartInsights = {
  /** Smoothed readings, for the chart. */
  samples: HeartSample[];
  avg: number;
  peak: number;
  /** Working sets with where their peak fell, for the chart's marks. */
  marks: { at: number; peakAt: number; peak: number; key: string }[];
  /** Hardest first. */
  exercises: ExerciseHeart[];
  /** Average drop in the first minute of rest, bpm; null when no rest was long enough to tell. */
  recovery: number | null;
  /** Rests that ran a full minute, so a drop could be measured. */
  recoveries: number;
  /** Sets started before the heart rate was halfway back to resting. */
  shortRests: number;
  /** Rests judged for that. */
  restsJudged: number;
  /** Minutes in each zone, 1 to 5 (50-60% ... 90%+ of max). */
  zones: number[];
  /** Edwards' training load: minutes in each zone times its number. */
  load: number;
  maxHr: number;
  resting: number;
};

/** The spacing Health's readings are asked for at (HeartInsights.swift). */
export const SAMPLE_MS = 5_000;
/** How long after a set is logged its peak can land. */
const PEAK_AFTER_MS = 45_000;
const PEAK_BEFORE_MS = 30_000;
/** Sets logged closer together than this were logged in one go, not done then. */
const BULK_MS = 20_000;
/** About how long a set takes: the next one began this long before it was logged. */
const SET_MS = 40_000;

/** Estimated maximum heart rate from age (Tanaka: 208 - 0.7 × age). */
export function estimatedMaxHr(age: number | null): number | null {
  return age != null && age >= 10 && age <= 100 ? Math.round(208 - 0.7 * age) : null;
}

/** Median of three neighbours: a single jumpy reading can't make a peak. */
function smooth(samples: HeartSample[]): HeartSample[] {
  return samples.map((s, i) => {
    if (i === 0 || i === samples.length - 1) return s;
    const trio = [samples[i - 1].bpm, s.bpm, samples[i + 1].bpm].sort((a, b) => a - b);
    return { t: s.t, bpm: trio[1] };
  });
}

function maxIn(samples: HeartSample[], from: number, to: number): HeartSample | null {
  let best: HeartSample | null = null;
  for (const s of samples) {
    if (s.t < from || s.t > to) continue;
    if (!best || s.bpm > best.bpm) best = s;
  }
  return best;
}

function minIn(samples: HeartSample[], from: number, to: number): number | null {
  let low: number | null = null;
  for (const s of samples) {
    if (s.t <= from || s.t > to) continue;
    if (low == null || s.bpm < low) low = s.bpm;
  }
  return low;
}

/** The reading nearest `t`, within one sample's spacing and a bit. */
function at(samples: HeartSample[], t: number): number | null {
  let near: HeartSample | null = null;
  for (const s of samples) {
    if (Math.abs(s.t - t) > SAMPLE_MS * 1.5) continue;
    if (!near || Math.abs(s.t - t) < Math.abs(near.t - t)) near = s;
  }
  return near?.bpm ?? null;
}

/**
 * The workout's heart rate, read against its sets. Null without enough
 * readings to say anything: a workout the watch didn't record has only the
 * odd background reading, so it needs one every half minute on average.
 */
export function analyzeHeart(
  raw: HeartSample[],
  sets: TimedSet[],
  { start, end, resting, maxHr }: { start: number; end: number; resting: number | null; maxHr: number | null },
): HeartInsights | null {
  const inWorkout = raw
    .filter((s) => s.t >= start && s.t <= end && s.bpm >= 30 && s.bpm <= 230)
    .sort((a, b) => a.t - b.t);
  const minutes = (end - start) / 60_000;
  if (inWorkout.length < 20 || inWorkout.length < minutes * 2) return null;
  const samples = smooth(inWorkout);

  const bpms = samples.map((s) => s.bpm);
  const peak = Math.max(...bpms);
  const avg = Math.round(bpms.reduce((n, b) => n + b, 0) / bpms.length);
  const low = Math.min(...bpms);
  const rest = resting != null && resting >= 30 && resting < low ? resting : Math.max(40, low - 15);
  const max = maxHr != null && maxHr > peak ? maxHr : Math.max(maxHr ?? 0, Math.round(peak / 0.95));

  // Sets on the trace, in the order they were logged; a burst logged in one
  // go (typed in afterwards, said all at once) can't be placed.
  const ordered = [...sets].filter((s) => s.at >= start && s.at <= end).sort((a, b) => a.at - b.at);
  const placed = ordered.filter((s, i) => i === 0 || s.at - ordered[i - 1].at >= BULK_MS);

  const marks: HeartInsights["marks"] = [];
  const byExercise = new Map<string, ExerciseHeart>();
  const drops: number[] = [];
  let shortRests = 0;
  let restsJudged = 0;

  placed.forEach((set, i) => {
    const next = placed[i + 1];
    const until = Math.min(set.at + PEAK_AFTER_MS, next ? next.at - SET_MS / 2 : Infinity);
    const top = maxIn(samples, set.at - PEAK_BEFORE_MS, until);
    if (!top || set.warmup) return;
    marks.push({ at: set.at, peakAt: top.t, peak: top.bpm, key: set.key });

    const exercise = byExercise.get(set.key) ?? { key: set.key, name: set.exercise, peak: 0, sets: 0 };
    exercise.peak = Math.max(exercise.peak, top.bpm);
    exercise.sets++;
    byExercise.set(set.key, exercise);

    // A minute's recovery, when the next set hadn't begun by then.
    const nextBegan = next ? next.at - SET_MS : Infinity;
    if (top.t + 60_000 <= nextBegan) {
      const after = at(samples, top.t + 60_000);
      if (after != null && after <= top.bpm) drops.push(top.bpm - after);
    }

    // Was it back down before the next set? The same line the watch's
    // heart-rate rest draws: halfway from the peak to resting.
    if (next) {
      const trough = minIn(samples, top.t, next.at);
      if (trough != null) {
        restsJudged++;
        if (trough > rest + (top.bpm - rest) / 2 + 2) shortRests++;
      }
    }
  });

  // Each reading stands for the stretch until the next (a gap counts at most 15s).
  const zones = [0, 0, 0, 0, 0];
  samples.forEach((s, i) => {
    const span = Math.min((samples[i + 1]?.t ?? s.t + SAMPLE_MS) - s.t, 15_000) / 60_000;
    const zone = Math.floor((s.bpm / max) * 10) - 4; // 50-60% is 1 ... 90%+ is 5
    if (zone >= 1) zones[Math.min(zone, 5) - 1] += span;
  });
  const load = Math.round(zones.reduce((n, m, i) => n + m * (i + 1), 0));

  return {
    samples,
    avg,
    peak,
    marks,
    exercises: [...byExercise.values()].sort((a, b) => b.peak - a.peak),
    recovery: drops.length ? Math.round(drops.reduce((n, d) => n + d, 0) / drops.length) : null,
    recoveries: drops.length,
    shortRests,
    restsJudged,
    zones: zones.map((m) => Math.round(m * 10) / 10),
    load,
    maxHr: max,
    resting: rest,
  };
}

/** This lifter's usual, from sessions read before on this phone (the median of up to eight). */
export type HeartUsual = { recovery: number | null; load: number | null };

export function usualOf(past: { recovery: number | null; load: number }[]): HeartUsual {
  const median = (xs: number[]) => {
    if (xs.length < 3) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };
  const recent = past.slice(-8);
  return {
    recovery: median(recent.map((p) => p.recovery).filter((r): r is number => r != null)),
    load: median(recent.map((p) => p.load)),
  };
}

const ZONE_NAMES = ["easy", "moderate", "hard", "very hard", "all-out"];

/**
 * The facts the summary is written from, one a line, numbers as they're
 * shown. Apple's on-device model rewords these and nothing else.
 */
export function heartFacts(h: HeartInsights, usual: HeartUsual): string[] {
  const facts: string[] = [];
  const hardest = h.exercises[0];
  if (hardest) facts.push(`Hardest exercise: ${hardest.name}, heart rate peaking at ${hardest.peak} bpm.`);
  facts.push(`Heart rate: ${h.avg} bpm on average, ${h.peak} bpm at the highest.`);
  if (h.recovery != null) {
    const vs = usual.recovery != null ? ` (usually ${usual.recovery} bpm)` : "";
    facts.push(`Recovery: heart rate fell ${h.recovery} bpm on average in the first minute of rest${vs}.`);
  }
  if (h.restsJudged > 0) {
    facts.push(
      h.shortRests === 0
        ? `Rests: every set started after heart rate had come back down.`
        : `Rests: ${h.shortRests} of ${h.restsJudged} sets started before heart rate had come back down.`,
    );
  }
  const vs = usual.load != null ? ` (usually ${usual.load})` : "";
  facts.push(`Training load: ${h.load}${vs}.`);
  const most = h.zones.indexOf(Math.max(...h.zones));
  if (h.zones[most] > 0) facts.push(`Most time spent ${ZONE_NAMES[most]}: ${Math.round(h.zones[most])} minutes.`);
  return facts;
}

/** The summary when the model can't write one: the two facts that matter most. */
export function heartTemplate(h: HeartInsights, usual: HeartUsual): string {
  const hardest = h.exercises[0];
  const first = hardest
    ? `${hardest.name} pushed you hardest, peaking at ${hardest.peak} bpm.`
    : `Your heart rate peaked at ${h.peak} bpm.`;
  let second = "";
  if (h.recovery != null) {
    const trend =
      usual.recovery == null
        ? ""
        : h.recovery > usual.recovery
          ? `, faster than usual`
          : h.recovery < usual.recovery
            ? `, slower than usual`
            : "";
    second = ` It came down ${h.recovery} bpm a minute into your rests${trend}.`;
  } else if (h.restsJudged > 0 && h.shortRests > 0) {
    second = ` ${h.shortRests} of ${h.restsJudged} sets started before it came back down.`;
  }
  return first + second;
}
