import { Constants, type Database } from "@/lib/database.types";

export type Muscle = Database["public"]["Enums"]["muscle_group"];

/** Canonical ordered list of all muscle groups (mirrors the DB enum). */
export const MUSCLES: readonly Muscle[] = Constants.public.Enums.muscle_group;

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  side_delt: "Side Delt",
  rear_delt: "Rear Delt",
  front_delt: "Front Delt",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  abs: "Abs",
  forearms: "Forearms",
  traps: "Traps",
};

/** The user's tracked weak points: highlighted across the dashboard/progress. */
export const WEAK_POINTS: readonly Muscle[] = [
  "back",
  "biceps",
  "triceps",
  "side_delt",
];

export function isWeakPoint(m: Muscle): boolean {
  return WEAK_POINTS.includes(m);
}

/** Small stabilisers hidden from the balance charts: they clutter the shape
 *  without guiding programming. */
export const CHART_HIDDEN_MUSCLES: ReadonlySet<Muscle> = new Set([
  "abs",
  "forearms",
  "traps",
]);

/** Display order for the weekly-sets bar chart: push, pull, legs, then rest. */
export const MUSCLE_CHART_ORDER: readonly Muscle[] = [
  "chest",
  "front_delt",
  "side_delt",
  "rear_delt",
  "triceps",
  "back",
  "traps",
  "biceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
];

export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "other",
] as const;

export const MECHANIC_OPTIONS = ["compound", "isolation"] as const;

/** Sets per muscle from exercises and their sets: the primary muscle counts a set, each secondary half. */
export function setsPerMuscle(
  items: { primary: Muscle; secondary: Muscle[]; sets: number }[],
): { muscle: Muscle; sets: number }[] {
  const per = new Map<Muscle, number>();
  for (const it of items) {
    if (it.sets <= 0) continue;
    per.set(it.primary, (per.get(it.primary) ?? 0) + it.sets);
    for (const s of it.secondary) if (s !== it.primary) per.set(s, (per.get(s) ?? 0) + it.sets / 2);
  }
  return [...per]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}
