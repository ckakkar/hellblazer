import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";

/** Gym shorthand, read as the words it stands for. */
const SHORTHAND: Record<string, string> = {
  db: "dumbbell",
  dbs: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  bw: "bodyweight",
};

/**
 * Whether an exercise matches what was typed, word by word in any order, so
 * "incline db" finds Incline Dumbbell Press and "curl bi" finds every biceps
 * curl. Each word has to appear in the name, the muscle or the equipment,
 * as typed or as the shorthand it is.
 */
export function matchesExercise(
  exercise: { name: string; primary_muscle: Muscle; equipment?: string | null },
  query: string,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${exercise.name} ${MUSCLE_LABEL[exercise.primary_muscle]} ${exercise.equipment ?? ""}`.toLowerCase();
  return words.every((w) => {
    const long = SHORTHAND[w];
    // Shorthand is a word of its own: "bb" isn't in "dumbbell".
    if (long !== undefined) return hay.includes(long) || new RegExp(`\\b${w}\\b`).test(hay);
    return hay.includes(w);
  });
}
