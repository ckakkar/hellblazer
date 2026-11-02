/**
 * A name for a workout that was never given one, from what was done in it:
 * "Bench Press", "Bench Press and Lat Pulldown", "Bench Press, Lat Pulldown
 * and 2 more". Kept under the 120 characters a title or template name takes.
 */
export function workoutName(lifts: string[]): string {
  const names = lifts.filter(Boolean);
  if (names.length === 0) return "Workout";
  if (names.length === 1) return names[0].slice(0, 120);
  if (names.length === 2) return `${names[0]} and ${names[1]}`.slice(0, 120);
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`.slice(0, 120);
}
