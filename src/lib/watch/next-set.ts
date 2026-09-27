import type { Unit } from "@/lib/units";
import type { WatchWorkout } from "@/lib/watch/protocol";

/**
 * Where the next set goes, and with what numbers, wherever it's logged
 * without the page in hand: "Same again" to Siri, the Lock Screen's Log Set,
 * the Control Center button. The page and the watch follow the same rules
 * (the logger's activity state; ios/App/Watch/WatchModel.swift): the
 * exercise being worked (the last one in order with a set) until its target's
 * met, then the next one that isn't finished, back round to any skipped.
 */

/** Just what the rules look at: a session exercise's target and sets. */
export type PlanExercise = {
  id: string;
  targetSets: number | null;
  sets: { n: number; weight: number; reps: number; warmup: boolean }[];
  /** The last session's working sets on this movement. */
  last: { weight: number; reps: number }[];
};

const working = (e: PlanExercise) => e.sets.filter((s) => !s.warmup);

/**
 * Its target sets are all in. An exercise without a target never is,
 * unless the lifter ended it (`ended`, the page's "Done with this one").
 */
export function metTarget(e: PlanExercise, ended?: ReadonlySet<string>): boolean {
  if (ended?.has(e.id)) return true;
  return e.targetSets != null && working(e).length >= e.targetSets;
}

/** Finished: its target met, or, without a target, at least one set in. */
export function isDone(e: PlanExercise, ended?: ReadonlySet<string>): boolean {
  if (ended?.has(e.id)) return true;
  return e.targetSets == null ? working(e).length > 0 : metTarget(e);
}

/**
 * Every exercise done: the workout's over bar the finish. One with no
 * targets at all (freeform) is never over until the lifter says so.
 */
export function isComplete(exercises: PlanExercise[], ended?: ReadonlySet<string>): boolean {
  return exercises.some((e) => e.targetSets != null) && exercises.every((e) => isDone(e, ended));
}

/** The first unfinished exercise after position `i`, wrapping round. */
export function nextUnfinished<E extends PlanExercise>(
  exercises: E[],
  i: number,
  ended?: ReadonlySet<string>,
): E | null {
  return [...exercises.slice(i + 1), ...exercises.slice(0, i)].find((e) => !isDone(e, ended)) ?? null;
}

/**
 * The exercise the next set belongs to: the last one in order with a set,
 * until its target's met, then the next unfinished one. Before any set, the
 * first unfinished exercise.
 */
export function exerciseForNextSet<E extends PlanExercise>(
  exercises: E[],
  ended?: ReadonlySet<string>,
): E | null {
  if (exercises.length === 0) return null;
  let i = -1;
  exercises.forEach((e, j) => {
    if (working(e).length > 0) i = j;
  });
  if (i < 0) return exercises.find((e) => !isDone(e, ended)) ?? exercises[0];
  const latest = exercises[i];
  if (!metTarget(latest, ended)) return latest;
  return nextUnfinished(exercises, i, ended) ?? latest;
}

/**
 * "Same again": this session's last working set on the exercise, else the
 * same set last time (else last time's final one), the way the logger
 * fills in a new set. Null when there's nothing to copy.
 */
export function sameAgain(e: PlanExercise): { weight: number; reps: number } | null {
  const done = working(e);
  if (done.length > 0) {
    const latest = done.reduce((a, b) => (b.n > a.n ? b : a));
    return { weight: latest.weight, reps: latest.reps };
  }
  const past = e.last[done.length] ?? e.last.at(-1) ?? null;
  return past ? { weight: past.weight, reps: past.reps } : null;
}

/** The set the Lock Screen's Log Set button logs, as it shows it. */
export type NextSet = {
  sessionExerciseId: string;
  weight: number;
  reps: number;
  /** "80 kg × 5". */
  label: string;
};

export function nextSetLabel(weight: number, reps: number, unit: Unit): string {
  const w = Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
  return `${w} ${unit} × ${reps}`;
}

/**
 * The workout as the Live Activity shows it, worded as the page words it
 * (activityState in the session logger): `current` is what's up next, and
 * `next` the set its Log Set button would log.
 */
export function activitySummary(
  workout: WatchWorkout,
  current: (PlanExercise & { name: string }) | null,
  complete: boolean,
  unit: Unit,
) {
  const sets = workout.exercises.flatMap(working);
  const volume = sets.reduce((n, s) => n + s.weight * s.reps, 0);
  const done = current ? working(current).length : 0;
  const numbers = current && !complete ? sameAgain(current) : null;
  const next: NextSet | null =
    current && numbers
      ? { sessionExerciseId: current.id, ...numbers, label: nextSetLabel(numbers.weight, numbers.reps, unit) }
      : null;
  return {
    sessionId: workout.id,
    startedAt: workout.startedAt,
    title: workout.title,
    exercise: current?.name ?? null,
    detail: !current
      ? null
      : complete
        ? "All sets done"
        : done > 0
          ? `${done} ${done === 1 ? "set" : "sets"} done`
          : "Up next",
    sets: sets.length,
    volume: `${Math.round(volume).toLocaleString("en-US")} ${unit}`,
    next,
  };
}
