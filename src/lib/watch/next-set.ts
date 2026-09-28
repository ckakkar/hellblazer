import type { Unit } from "@/lib/units";
import type { WatchWorkout } from "@/lib/watch/protocol";
import { supersetSlots } from "@/lib/supersets";

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
  sets: { n: number; weight: number; reps: number; warmup: boolean; kind?: string | null }[];
  /** Its superset group (supersets.ts); null or absent on its own. */
  superset?: number | null;
  /** The last session's working sets on this movement. */
  last: { weight: number; reps: number }[];
  /** Today's target from those (progression.ts), for the first set. */
  target?: { weight: number; reps: number } | null;
};

/** The sets that count toward the plan: no warm-ups, no drop sets. */
const working = (e: PlanExercise) => e.sets.filter((s) => !s.warmup && s.kind !== "drop");

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
 * first unfinished exercise. In a superset (supersets.ts) it's whichever of
 * its unfinished exercises has the fewest sets, the first on a tie, so they
 * alternate: A1, A2, A1, A2.
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
  const slot = supersetSlots(exercises, (e) => e.superset)[i];
  if (slot) {
    const open = slot.members.map((m) => exercises[m]).filter((e) => !metTarget(e, ended));
    if (open.length > 0) return open.reduce((a, b) => (working(b).length < working(a).length ? b : a));
    return nextUnfinished(exercises, slot.members[slot.members.length - 1], ended) ?? exercises[i];
  }
  const latest = exercises[i];
  if (!metTarget(latest, ended)) return latest;
  return nextUnfinished(exercises, i, ended) ?? latest;
}

/**
 * After a set on `loggedId`, whether a rest comes before the next one: not
 * when the next set is a superset partner's that's still behind on the
 * round. `exercises` already has the set.
 */
export function restsAfter(exercises: PlanExercise[], loggedId: string, ended?: ReadonlySet<string>): boolean {
  const next = exerciseForNextSet(exercises, ended);
  const logged = exercises.find((e) => e.id === loggedId);
  if (!next || !logged || next.id === loggedId) return true;
  const slots = supersetSlots(exercises, (e) => e.superset);
  const slot = slots[exercises.indexOf(logged)];
  if (!slot || !slot.members.includes(exercises.indexOf(next))) return true;
  return working(next).length >= working(logged).length;
}

/**
 * "Same again": this session's last working set on the exercise, else
 * today's target (progression.ts), else the same set last time (else last
 * time's final one), the way the logger fills in a new set. Null when
 * there's nothing to go on.
 */
export function sameAgain(e: PlanExercise): { weight: number; reps: number } | null {
  // A drop set's lighter numbers are never the next straight set's.
  const done = working(e);
  if (done.length > 0) {
    const latest = done.reduce((a, b) => (b.n > a.n ? b : a));
    return { weight: latest.weight, reps: latest.reps };
  }
  if (e.target) return { weight: e.target.weight, reps: e.target.reps };
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
