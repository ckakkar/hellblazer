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

/** The user's tracked weak points — highlighted across the dashboard/progress. */
export const WEAK_POINTS: readonly Muscle[] = [
  "back",
  "biceps",
  "triceps",
  "side_delt",
];

export function isWeakPoint(m: Muscle): boolean {
  return WEAK_POINTS.includes(m);
}

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
