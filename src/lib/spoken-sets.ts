import { KG_PER_LB, trimNum, type Unit } from "@/lib/units";

/**
 * Sets said in the lifter's own words ("3 sets of 8 at 80 on incline, last
 * one was a grinder"), read on the iPhone by Apple's on-device model
 * (ios/App/App/SetReader.swift). The model only pulls out what was said;
 * which exercise it means, the numbers left out and every limit are decided
 * here, the same for the logger's "Say it" and for "Log a set" to Siri
 * (logHeardSets in watch/server.ts).
 */

/** One run of like sets, as the model heard it. */
export type HeardGroup = {
  /** The exercise, as the workout names it or in the lifter's words; null: not said. */
  exercise: string | null;
  /** How many sets like this. */
  sets: number;
  /** Null: not said ("two more at 85"). */
  reps: number | null;
  /** Null: not said ("8 more on bench"). */
  weight: number | null;
  /** The unit said with the weight; null: their usual one. */
  unit: Unit | null;
  /** Effort out of 10, when they described it. */
  rpe: number | null;
  warmup: boolean;
};

/** Most sets one sentence can log: a whole session caught up, not a year of it. */
export const MAX_SPOKEN_SETS = 30;
const MAX_GROUPS = 12;
const MAX_PER_GROUP = 10;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * What came back from the model (or a device), made safe: numbers in range,
 * the rest dropped. Never throws.
 */
export function parseHeard(raw: unknown): HeardGroup[] {
  if (!Array.isArray(raw)) return [];
  const groups: HeardGroup[] = [];
  for (const item of raw.slice(0, MAX_GROUPS)) {
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;
    const words = typeof g.exercise === "string" ? g.exercise.trim().slice(0, 80) : "";
    const sets = num(g.sets);
    const reps = num(g.reps);
    const weight = num(g.weight);
    const rpe = num(g.rpe);
    groups.push({
      exercise: words || null,
      sets: sets == null ? 1 : Math.min(MAX_PER_GROUP, Math.max(1, Math.round(sets))),
      reps: reps != null && reps >= 1 && reps <= 100 ? Math.round(reps) : null,
      weight: weight != null && weight >= 0 && weight <= 2000 ? weight : null,
      unit: g.unit === "kg" || g.unit === "lb" ? g.unit : null,
      // 0 is how the model says "not described".
      rpe: rpe != null && rpe >= 1 && rpe <= 10 ? Math.round(rpe * 2) / 2 : null,
      warmup: g.warmup === true,
    });
  }
  return groups;
}

// --- Which exercise ---------------------------------------------------------

const ALIASES: Record<string, string[]> = {
  db: ["dumbbell"],
  dbs: ["dumbbell"],
  bb: ["barbell"],
  ohp: ["overhead", "press"],
  rdl: ["romanian", "deadlift"],
  rdls: ["romanian", "deadlift"],
  sldl: ["stiff", "leg", "deadlift"],
  lateral: ["side"],
  laterals: ["side", "raise"],
  flies: ["fly"],
  flyes: ["fly"],
  calves: ["calf"],
  skullcrusher: ["skull", "crusher"],
  skullcrushers: ["skull", "crusher"],
  skulls: ["skull", "crusher"],
  pushdowns: ["pushdown"],
  pulldowns: ["pulldown"],
  chins: ["chinup"],
  pullups: ["pullup"],
  chinups: ["chinup"],
  dips: ["dip"],
};

/** Words that say nothing about which exercise. */
const FILLER = new Set([
  "a", "an", "and", "at", "for", "my", "of", "on", "the", "then", "with", "some", "more",
  "set", "sets", "rep", "reps", "kg", "kgs", "kilo", "kilos", "lb", "lbs", "pound", "pounds",
]);

/** Words many exercises share: they count, but for less. */
const COMMON = new Set([
  "press", "row", "curl", "raise", "extension", "fly", "machine", "cable", "dumbbell",
  "barbell", "smith", "seated", "standing", "lying", "weighted", "single", "arm", "leg", "grip",
]);

function singular(word: string): string {
  return word.length >= 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !/^\d+$/.test(w))
    .flatMap((w) => ALIASES[w] ?? [singular(w)])
    .filter((w) => !FILLER.has(w));
}

/**
 * The workout's exercise the lifter meant by `words`: the name itself, a
 * part of it ("incline", "skulls", "pull-ups"), or null when nothing in the
 * workout fits. Between equals, the one whose name the words cover more of
 * ("bench" is Bench Press, not Close-Grip Bench Press), then the one they're
 * on (`prefer`), then the earlier.
 */
export function matchExercise<E extends { id: string; name: string }>(
  words: string,
  exercises: E[],
  prefer?: string | null,
): E | null {
  const said = tokens(words);
  if (said.length === 0) return null;
  const saidJoined = said.join("");
  let best: { e: E; score: number; cover: number; preferred: boolean } | null = null;
  for (const e of exercises) {
    const name = tokens(e.name);
    const joined = name.join("");
    let score = 0;
    if (joined === saidJoined) score = 100;
    else {
      const found = said.filter((w) => name.includes(w));
      // Only shared words ("leg press" and a bench press share "press") is
      // a different exercise, unless they said nothing else ("rows").
      if (found.some((w) => !COMMON.has(w)) || found.length === said.length) {
        score = found.reduce((n, w) => n + (COMMON.has(w) ? 0.4 : 1), 0);
      }
      // "pull ups" in "Weighted Pullup": the words run together in the name.
      if (score === 0 && saidJoined.length >= 4 && joined.includes(saidJoined)) score = 1;
    }
    if (score === 0) continue;
    const cover = name.filter((w) => said.includes(w)).length / Math.max(1, name.length);
    const candidate = { e, score, cover, preferred: e.id === prefer };
    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score &&
        (candidate.cover > best.cover || (candidate.cover === best.cover && candidate.preferred && !best.preferred)))
    ) {
      best = candidate;
    }
  }
  return best?.e ?? null;
}

// --- The sets ---------------------------------------------------------------

/** An exercise of the workout, as the reading needs it. */
export type SpokenExercise = {
  id: string;
  name: string;
  /** Where a new set here starts from ("same again"), or null. */
  same: { weight: number; reps: number } | null;
};

export type SpokenSet = {
  exerciseId: string;
  /** Display unit. */
  weight: number;
  reps: number;
  rpe: number | null;
  warmup: boolean;
};

export type SpokenPlan = {
  sets: SpokenSet[];
  /** Exercises said that aren't in this workout, in the lifter's words. */
  unmatched: string[];
  /** Runs left out for want of reps, with nothing to copy them from. */
  unclear: number;
};

/** A weight said in one unit, in the lifter's own, to the half. */
function inUnit(weight: number, said: Unit | null, unit: Unit): number {
  if (!said || said === unit) return Math.round(weight * 100) / 100;
  const converted = said === "kg" ? weight / KG_PER_LB : weight * KG_PER_LB;
  return Math.round(converted * 2) / 2;
}

/**
 * The sets to log. A run without an exercise goes with the one before it
 * ("…then two more at 85"), else `current`, the one they're on. A number
 * left out comes from the set before it on that exercise, in this sentence
 * or else the workout ("same again"); no weight at all is bodyweight.
 */
export function planSpokenSets(
  groups: HeardGroup[],
  exercises: SpokenExercise[],
  { unit, current }: { unit: Unit; current: string | null },
): SpokenPlan {
  const sets: SpokenSet[] = [];
  const unmatched: string[] = [];
  let unclear = 0;
  const said = new Map<string, { weight: number; reps: number }>();
  let previous = null as SpokenExercise | null;
  const fallback = exercises.find((e) => e.id === current) ?? null;

  for (const g of groups) {
    let exercise: SpokenExercise | null;
    if (g.exercise) {
      exercise = matchExercise(g.exercise, exercises, previous?.id ?? current);
      if (!exercise) {
        if (!unmatched.includes(g.exercise)) unmatched.push(g.exercise);
        continue;
      }
    } else {
      exercise = previous ?? fallback;
    }
    if (!exercise) {
      unclear++;
      continue;
    }
    previous = exercise;

    const before = said.get(exercise.id) ?? exercise.same;
    const reps = g.reps ?? before?.reps ?? null;
    if (reps == null) {
      unclear++;
      continue;
    }
    const weight = g.weight != null ? inUnit(g.weight, g.unit, unit) : (before?.weight ?? 0);

    for (let i = 0; i < g.sets && sets.length < MAX_SPOKEN_SETS; i++) {
      sets.push({ exerciseId: exercise.id, weight, reps, rpe: g.rpe, warmup: g.warmup });
    }
    if (!g.warmup) said.set(exercise.id, { weight, reps });
  }
  return { sets, unmatched, unclear };
}

// --- Saying it back ---------------------------------------------------------

/** The sets grouped as they'll show: each exercise once, in the order said. */
export function groupByExercise(sets: SpokenSet[]): { exerciseId: string; sets: SpokenSet[] }[] {
  const out: { exerciseId: string; sets: SpokenSet[] }[] = [];
  for (const s of sets) {
    const last = out.find((g) => g.exerciseId === s.exerciseId);
    if (last) last.sets.push(s);
    else out.push({ exerciseId: s.exerciseId, sets: [s] });
  }
  return out;
}

function load(weight: number, unit: Unit): string {
  return weight === 0 ? "bodyweight" : `${trimNum(weight)} ${unit}`;
}

/**
 * What Siri says back: "3 sets of 8 at 80 kg on Incline DB Press, the last
 * at RPE 9". Runs of the same numbers are said once.
 */
export function describeSpokenSets(
  sets: SpokenSet[],
  names: Map<string, string>,
  unit: Unit,
): string {
  return groupByExercise(sets)
    .map(({ exerciseId, sets: list }) => {
      const name = names.get(exerciseId) ?? "that exercise";
      const runs: { weight: number; reps: number; warmup: boolean; count: number }[] = [];
      for (const s of list) {
        const run = runs.at(-1);
        if (run && run.weight === s.weight && run.reps === s.reps && run.warmup === s.warmup) run.count++;
        else runs.push({ weight: s.weight, reps: s.reps, warmup: s.warmup, count: 1 });
      }
      const said = runs.map((r) => {
        const what = `${r.reps} at ${load(r.weight, unit)}`;
        const kind = r.warmup ? (r.count === 1 ? "warm-up" : "warm-ups") : r.count === 1 ? "set" : "sets";
        return `${r.count === 1 ? (r.warmup ? "a" : "1") : r.count} ${kind} of ${what}`;
      });
      const rpe = list.at(-1)?.rpe ?? null;
      const effort =
        rpe == null
          ? ""
          : list.length > 1 && list.every((s) => s.rpe === rpe)
            ? `, all at RPE ${trimNum(rpe)}`
            : list.length > 1
              ? `, the last at RPE ${trimNum(rpe)}`
              : `, at RPE ${trimNum(rpe)}`;
      return `${said.join(", then ")} on ${name}${effort}`;
    })
    .join("; ");
}
