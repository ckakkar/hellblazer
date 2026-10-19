import { trimNum, type Unit } from "@/lib/units";

/**
 * The logger's words: last time's sets written the way a lifter jots them,
 * and the one line under the workout's figures that says something about
 * this workout (or nothing). Personality comes from the numbers, not from
 * slogans: a line only appears when the data has something to say.
 */

/**
 * Sets as a training notebook writes them: the weight once when it didn't
 * change ("62.5 kg × 11, 11, 10"), each set's own otherwise ("60 × 8, 62.5 ×
 * 6 kg"). Weights in the display unit; a bodyweight set is "BW".
 */
export function notebookSets(sets: { weight: number; reps: number }[], unit: Unit): string {
  if (sets.length === 0) return "";
  const w = (n: number) => (n === 0 ? "BW" : trimNum(n));
  const first = sets[0].weight;
  if (sets.every((s) => s.weight === first)) {
    const reps = sets.map((s) => s.reps).join(", ");
    return first === 0 ? `BW × ${reps}` : `${w(first)} ${unit} × ${reps}`;
  }
  const list = sets.map((s) => `${w(s.weight)} × ${s.reps}`).join(", ");
  return sets.some((s) => s.weight > 0) ? `${list} ${unit}` : list;
}

/** Reps at `weightKg` that would beat a best estimated max (Epley), or null. */
export function repsToBeat(weightKg: number, bestEst1rm: number): number | null {
  if (!(weightKg > 0) || !(bestEst1rm > 0)) return null;
  // weight × (1 + reps / 30) > best  ⇔  reps > 30 × (best / weight − 1)
  const reps = Math.floor(30 * (bestEst1rm / weightKg - 1)) + 1;
  return reps >= 1 ? reps : 1;
}

export type CoachInput = {
  exercises: number;
  done: number;
  /** Records broken so far this workout. */
  records: number;
  /** The exercise on the bar, before its first set: today's target in the
   *  display unit, its weight in kg, and the lift's best estimated max (kg)
   *  from earlier sessions, if it has any. */
  next: { name: string; targetWeight: number; targetWeightKg: number; targetReps: number; bestEst1rm: number | null } | null;
  unit: Unit;
};

/** One observation about the workout, or null when there's nothing to say. */
export function coachLine(input: CoachInput): string | null {
  const { exercises, done, records, next, unit } = input;
  if (exercises > 0 && done >= exercises) {
    return records > 0
      ? `Every exercise done, ${records === 1 ? "a record" : `${records} records`} broken. Finish when you're ready.`
      : "Every exercise done. Finish when you're ready.";
  }
  if (next && next.bestEst1rm) {
    const reps = repsToBeat(next.targetWeightKg, next.bestEst1rm);
    // Only when it's in reach of today's target, or it's noise.
    if (reps !== null && reps <= next.targetReps + 2) {
      return `${reps} ${reps === 1 ? "rep" : "reps"} at ${trimNum(next.targetWeight)} ${unit} on ${next.name} beats your best.`;
    }
  }
  if (records > 0) return records === 1 ? "A record broken today." : `${records} records broken today.`;
  return null;
}
