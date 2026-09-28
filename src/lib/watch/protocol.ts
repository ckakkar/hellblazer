import type { Unit } from "@/lib/units";

/**
 * The Apple Watch app's view of the lifter, as JSON from /api/watch/*. The
 * Swift side is ios/App/Watch/WatchAPI.swift: change both together.
 *
 * Weights are in the lifter's display unit (the watch sends it in the
 * `X-Fatty-Unit` header); the server converts to and from canonical kg, so
 * the watch never does unit math.
 */
export type WatchState = {
  unit: Unit;
  /** The session in progress, or null. */
  active: WatchWorkout | null;
  /** The next day of the active program, when there is one. */
  next: WatchStartOption | null;
  /** What the watch can start: the active program's days, else every template. */
  options: WatchStartOption[];
  /** This week so far, for the watch face complications. */
  week: WatchWeek;
};

export type WatchWeek = {
  /** Monday, yyyy-MM-dd in the lifter's calendar. */
  start: string;
  sessions: number;
  /** Days a week in the active program; null without one. */
  planned: number | null;
  sets: number;
};

export type WatchWorkout = {
  id: string;
  title: string;
  /** Epoch ms. */
  startedAt: number;
  exercises: WatchExercise[];
};

export type WatchExercise = {
  /** The session_exercise id: sets are logged against it. */
  id: string;
  name: string;
  targetSets: number | null;
  targetReps: string | null;
  /** Seconds to rest after its sets (the template's); null: the lifter's usual. */
  restSeconds: number | null;
  sets: WatchSet[];
  /** The last session's working sets on this movement, for copy-forward. */
  last: { weight: number; reps: number }[];
  /** Today's target from them (src/lib/progression.ts): the first set's numbers. */
  target: WatchTarget | null;
  /** Its superset group (src/lib/supersets.ts); null on its own. */
  superset: number | null;
};

export type WatchTarget = { weight: number; reps: number };

export type WatchSet = {
  id: string;
  n: number;
  weight: number;
  reps: number;
  warmup: boolean;
  /** "drop" or "rest_pause", logged in the app; absent for a plain set. */
  kind?: string | null;
};

export type WatchStartOption = {
  templateId: string;
  /** Set for the active program's days: starting one advances the block. */
  programDayId: string | null;
  label: string;
  exercises: number;
  /**
   * The day's exercises, so the watch can start it with no connection and
   * catch the server up later. Sent while no workout is on (that's when a
   * start can happen), and kept on the watch.
   */
  plan?: WatchPlanExercise[];
};

export type WatchPlanExercise = {
  name: string;
  targetSets: number | null;
  targetReps: string | null;
  restSeconds: number | null;
  last: { weight: number; reps: number }[];
  /** Today's target, as on WatchExercise. */
  target: WatchTarget | null;
  /** Its superset group, as on WatchExercise. */
  superset: number | null;
};
