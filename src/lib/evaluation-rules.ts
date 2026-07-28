/**
 * Evaluation gating rules: the shape and the constants, with no server
 * imports, so client components can read them too. The queries that populate
 * an `EvalGate` live in `@/lib/data/evaluation` (server-only).
 */

/** Days a lifter must wait between tier evaluations. */
export const EVAL_COOLDOWN_DAYS = 5;

export type EvalGate = {
  canRun: boolean;
  /** Why not, when `canRun` is false. */
  reason: "ok" | "no_workout" | "no_new_workout" | "cooldown";
  /** Qualifying workouts logged since the last evaluation run. */
  newWorkouts: number;
  /** Qualifying workouts ever. */
  totalWorkouts: number;
  lastRunAt: string | null;
  /** When the cooldown lifts (ISO), or null when not cooling down. */
  nextRunAt: string | null;
};

/** Whole days until `iso`, floored at 1 so "later today" never reads as 0. */
export function daysUntil(iso: string): number {
  return Math.max(
    1,
    Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000),
  );
}
