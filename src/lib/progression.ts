import type { Unit } from "@/lib/units";

/**
 * Next-time targets: what to aim for on a lift today, from last session's
 * working sets and the template's rep range. Double progression, the way
 * most programs run it:
 *
 * - every set at the working weight reached the top of the range, the
 *   last wasn't all-out, and the day's sets were all done: add weight, back
 *   to the bottom of the range (a shortened day, two sets of a planned
 *   three, earns the top of the range again, not more weight);
 * - fell short of the range: hold the weight, aim for the bottom of it;
 * - otherwise: same weight, one more rep than last time's weakest set.
 *
 * Without a range (a freeform lift) it's one more rep than last time's top
 * set, or more weight when that set was easy.
 *
 * A lift back after three weeks or more off starts about a tenth lighter
 * (to the nearest jump the gym has) at last time's reps, whatever last time
 * said: strength fades with time off, and "beat last time" is the wrong
 * advice then. The same rules serve the logger, the Lock Screen's Log Set,
 * "same again" to Siri and the watch.
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
  /** Up: more weight. Same: one more rep. Hold: last time fell short.
   *  Back: lighter, after a break ({@link BREAK_DAYS}). */
  change: "up" | "same" | "hold" | "back";
  /** The weight added, display unit (0 unless up). */
  added: number;
  /** Whole weeks since the lift was last done; set only when it's back after a break. */
  weeksOff?: number;
};

/** Days off a lift after which today's target starts lighter. */
export const BREAK_DAYS = 21;
/** How much of last time's load (or reps, at bodyweight) a lift comes back at. */
const EASE = 0.9;

/** Whole days from one calendar date (yyyy-MM-dd) to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** About a tenth off, to the nearest step the gym has (a tie goes lighter), and at least one step. */
function eased(weight: number, step: number): number {
  let w = Math.ceil((weight * EASE) / step - 0.5) * step;
  if (w >= weight) w = weight - step;
  return Math.round(w * 100) / 100;
}

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
  plannedSets = null,
  daysOff = null,
}: {
  last: LastSet[];
  range: string | null;
  lift: Lift;
  unit: Unit;
  /** The working sets the plan asks for; null without a plan. */
  plannedSets?: number | null;
  /** Days since last time ({@link daysBetween}); null when not known. */
  daysOff?: number | null;
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
  if (daysOff != null && daysOff >= BREAK_DAYS) {
    const weeksOff = Math.floor(daysOff / 7);
    const top = Math.max(...working.map((s) => s.reps));
    const fewest = Math.min(...working.map((s) => s.reps));
    const lighter = weight > 0 ? eased(weight, step) : 0;
    if (lighter > 0) {
      // Last time's reps, inside the range when there is one.
      const reps = bounds ? Math.min(bounds[1], Math.max(bounds[0], fewest)) : top;
      return { weight: lighter, reps, change: "back", added: 0, weeksOff };
    }
    // Bodyweight, or too light to take a step off: fewer reps instead.
    return { weight, reps: Math.max(1, Math.round(top * EASE)), change: "back", added: 0, weeksOff };
  }
  if (!bounds) {
    const top = Math.max(...working.map((s) => s.reps));
    return canAdd && lastRpe != null && lastRpe <= EASY ? up(top) : same(top + 1);
  }
  const [lo, hi] = bounds;
  const fewest = Math.min(...working.map((s) => s.reps));
  const allDone = plannedSets == null || working.length >= plannedSets;
  if (fewest >= hi && !allOut && !allDone) return same(hi);
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
  if (t.change === "back") return `10% under, ${t.weeksOff ?? 3} weeks off`;
  return "one more rep";
}
