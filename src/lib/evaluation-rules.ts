/**
 * Evaluation gating rules: the shape and the constants, with no server
 * imports, so client components can read them too. The queries that populate
 * an `EvalGate` live in `@/lib/data/evaluation` (server-only).
 */

import { getTier } from "@/lib/tiers";

/** Days a lifter must wait between tier evaluations. */
export const EVAL_COOLDOWN_DAYS = 5;

/**
 * Rank you must climb *past* for the judge to answer without limit: Julius
 * Reinhold sits at 5, so Raian (6) and up are unlimited.
 *
 * This mirrors the ladder's two regimes. Below and up to the Monster the judge
 * is scarce and a verdict has to be earned; past him the ladder rewards you,
 * and the rate limit that made every judgment precious just gets in the way.
 */
export const UNLIMITED_EVAL_ABOVE_RANK = 5;

/** Has this lifter climbed past Julius, and so earned an unlimited judge? */
export function hasUnlimitedEvaluations(
  tierKey: string | null | undefined,
): boolean {
  const tier = getTier(tierKey);
  return !!tier && tier.rank > UNLIMITED_EVAL_ABOVE_RANK;
}

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
  /** Past Julius: no cooldown, no once-per-workout rule. Judge on demand. */
  unlimited: boolean;
};

/** Whole days until `iso`, floored at 1 so "later today" never reads as 0. */
export function daysUntil(iso: string): number {
  return Math.max(
    1,
    Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000),
  );
}
