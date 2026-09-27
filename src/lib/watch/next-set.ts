import type { Unit } from "@/lib/units";
import type { WatchExercise, WatchWorkout } from "@/lib/watch/protocol";

/**
 * Where a set logged without the page goes, and with what numbers: "Same
 * again" and "Log a set" said to Siri, the Action button, the Control Center
 * button. The rules are the watch's logger's (ios/App/Watch/WatchModel.swift):
 * the exercise being worked until its target's met, then the next one that
 * isn't finished, back round to any skipped.
 */

const working = (e: WatchExercise) => e.sets.filter((s) => !s.warmup);

/** Its target sets are all in. An exercise without a target never is. */
export function metTarget(e: WatchExercise): boolean {
  return e.targetSets != null && working(e).length >= e.targetSets;
}

/** Finished: its target met, or, without a target, at least one set in. */
export function isDone(e: WatchExercise): boolean {
  return e.targetSets == null ? working(e).length > 0 : metTarget(e);
}

/**
 * Every exercise done: the workout's over bar the finish. One with no
 * targets at all (freeform) is never over until the lifter says so.
 */
export function isComplete(exercises: WatchExercise[]): boolean {
  return exercises.some((e) => e.targetSets != null) && exercises.every(isDone);
}

/** The first unfinished exercise after position `i`, wrapping round. */
export function nextUnfinished(exercises: WatchExercise[], i: number): WatchExercise | null {
  return [...exercises.slice(i + 1), ...exercises.slice(0, i)].find((e) => !isDone(e)) ?? null;
}

/**
 * The exercise the next set belongs to. `latestId` is the exercise of the
 * set logged most recently: it stays current until its target's met.
 * Before any set, the first unfinished exercise.
 */
export function exerciseForNextSet(
  exercises: WatchExercise[],
  latestId: string | null,
): WatchExercise | null {
  if (exercises.length === 0) return null;
  const i = latestId ? exercises.findIndex((e) => e.id === latestId) : -1;
  if (i < 0) return exercises.find((e) => !isDone(e)) ?? exercises[0];
  const latest = exercises[i];
  if (!metTarget(latest)) return latest;
  return nextUnfinished(exercises, i) ?? latest;
}

/**
 * "Same again": this session's last working set on the exercise, else the
 * same set last time (else last time's final one), the way the logger
 * fills in a new set. Null when there's nothing to copy.
 */
export function sameAgain(e: WatchExercise): { weight: number; reps: number } | null {
  const done = working(e);
  if (done.length > 0) {
    const latest = done.reduce((a, b) => (b.n > a.n ? b : a));
    return { weight: latest.weight, reps: latest.reps };
  }
  const past = e.last[0] ?? null;
  return past ? { weight: past.weight, reps: past.reps } : null;
}

/**
 * The workout as the Live Activity shows it, worded as the page words it
 * (activityState in the session logger): `current` is what's up next.
 */
export function activitySummary(
  workout: WatchWorkout,
  current: WatchExercise | null,
  complete: boolean,
  unit: Unit,
) {
  const sets = workout.exercises.flatMap(working);
  const volume = sets.reduce((n, s) => n + s.weight * s.reps, 0);
  const done = current ? working(current).length : 0;
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
  };
}
