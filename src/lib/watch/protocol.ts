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
  sets: WatchSet[];
  /** The last session's working sets on this movement, for copy-forward. */
  last: { weight: number; reps: number }[];
};

export type WatchSet = {
  id: string;
  n: number;
  weight: number;
  reps: number;
  warmup: boolean;
};

export type WatchStartOption = {
  templateId: string;
  /** Set for the active program's days: starting one advances the block. */
  programDayId: string | null;
  label: string;
  exercises: number;
};
