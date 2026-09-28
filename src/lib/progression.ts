import type { Unit } from "@/lib/units";

/**
 * Next-time targets: what to aim for on a lift today, from last session's
 * working sets and the template's rep range. Double progression, the way
 * most programs run it:
 *
 * - every set at the working weight reached the top of the range, and the
 *   last wasn't all-out: add weight, back to the bottom of the range;
 * - fell short of the range: hold the weight, aim for the bottom of it;
 * - otherwise: same weight, one more rep than last time's weakest set.
 *
 * Without a range (a freeform lift) it's one more rep than last time's top
 * set, or more weight when that set was easy. The same rules serve the
 * logger, the Lock Screen's Log Set, "same again" to Siri and the watch.
 */

export type LastSet = { weight: number; reps: number; rpe: number | null };

export type Lift = {
  equipment: string | null;
  mechanic: string | null;
  primaryMuscle: string | null;
};

export type Target = {
  /** Display unit. */
  weight: number;
  reps: number;
  /** Up: more weight. Same: one more rep. Hold: last time fell short. */
  change: "up" | "same" | "hold";
  /** The weight added, display unit (0 unless up). */
  added: number;
};

const LOWER_BODY = new Set(["quads", "hamstrings", "glutes"]);

/** A rep range as the templates write it: "8-12", "8–12", "5". */
export function parseRange(range: string | null | undefined): [number, number] | null {
  const m = /^\s*(\d{1,3})\s*(?:[-–to]+\s*(\d{1,3}))?\s*$/.exec(range ?? "");
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  return lo >= 1 && hi >= lo ? [lo, hi] : null;
}

/**
 * The step up for a lift, in the lifter's unit: the jumps a gym has. The big
 * lower-body barbell lifts go up twice as fast as everything else.
 */
export function increment(lift: Lift, unit: Unit): number {
  const kg = unit === "kg";
  if (lift.equipment === "barbell") {
    const big = lift.mechanic === "compound" && LOWER_BODY.has(lift.primaryMuscle ?? "");
    return kg ? (big ? 5 : 2.5) : big ? 10 : 5;
  }
  if (lift.equipment === "dumbbell") return kg ? 2 : 5;
  return kg ? 2.5 : 5;
}

/** All-out: nothing left, so the same weight again rather than more. */
const ALL_OUT = 9.5;
/** Easy enough on a freeform lift to go up. */
const EASY = 7;

/** Today's target, or null with nothing from last time to go on. */
export function nextTarget({
  last,
  range,
  lift,
  unit,
}: {
  last: LastSet[];
  range: string | null;
  lift: Lift;
  unit: Unit;
}): Target | null {
  const sets = last.filter((s) => s.reps > 0 && s.weight >= 0);
  if (sets.length === 0) return null;
  const weight = Math.max(...sets.map((s) => s.weight));
  const working = sets.filter((s) => s.weight === weight);
  const lastRpe = sets[sets.length - 1].rpe;
  const allOut = lastRpe != null && lastRpe >= ALL_OUT;
  // Bodyweight work goes up in reps; weighted bodyweight work can add weight.
  const canAdd = !(lift.equipment === "bodyweight" && weight === 0);
  const step = increment(lift, unit);
  const up = (reps: number): Target => ({ weight: weight + step, reps, change: "up", added: step });
  const same = (reps: number): Target => ({ weight, reps, change: "same", added: 0 });

  const bounds = parseRange(range);
  if (!bounds) {
    const top = Math.max(...working.map((s) => s.reps));
    return canAdd && lastRpe != null && lastRpe <= EASY ? up(top) : same(top + 1);
  }
  const [lo, hi] = bounds;
  const fewest = Math.min(...working.map((s) => s.reps));
  if (fewest >= hi && !allOut) return canAdd ? up(lo) : same(hi + 1);
  if (fewest < lo) return { weight, reps: lo, change: "hold", added: 0 };
  return same(Math.min(hi, fewest + 1));
}

/** "82.5 kg × 8", "Bodyweight × 12". */
export function targetLabel(t: Pick<Target, "weight" | "reps">, unit: Unit): string {
  const w = Number.isInteger(t.weight) ? String(t.weight) : String(Math.round(t.weight * 100) / 100);
  return `${t.weight === 0 ? "Bodyweight" : `${w} ${unit}`} × ${t.reps}`;
}

/** Why: "up 2.5 kg", "one more rep", "hold the weight". */
export function targetReason(t: Target, unit: Unit): string {
  if (t.change === "up") return `up ${Number.isInteger(t.added) ? t.added : t.added.toFixed(1)} ${unit}`;
  if (t.change === "hold") return "hold the weight";
  return "one more rep";
}
