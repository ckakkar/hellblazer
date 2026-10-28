/**
 * What a set counts for, decided once, so the logger, the Lock Screen, Siri,
 * the live board, the server and the watch (WatchAPI.swift mirrors it) agree:
 *
 * - A row with no reps yet is a draft. It counts for nothing and stays on
 *   the device until it has a rep (the database won't take a 0-rep set).
 * - Work is every logged set that isn't a warm-up. Drop and rest-pause sets
 *   count in full toward the workout's sets and volume, as they do toward
 *   weekly sets per muscle.
 * - Straight sets are plain work. Only these use up one of an exercise's
 *   planned sets, and only these are "same again" and what "+ set" copies:
 *   an extension set's lighter or shorter numbers are never the next set's.
 */

export type CountedSet = {
  warmup: boolean;
  kind?: string | null;
  reps: number | null | undefined;
};

/** At least one whole rep: a set the server keeps. */
export function isLogged(reps: number | null | undefined): reps is number {
  return typeof reps === "number" && Number.isInteger(reps) && reps >= 1;
}

/** Counts toward the workout's sets and volume. */
export function isWork(s: CountedSet): boolean {
  return !s.warmup && isLogged(s.reps);
}

/** A plain working set: uses up a planned set, and sets "same again". */
export function isStraight(s: CountedSet): boolean {
  return isWork(s) && s.kind !== "drop" && s.kind !== "rest_pause";
}
