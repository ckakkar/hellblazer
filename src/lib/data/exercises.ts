import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { getExerciseStats } from "@/lib/data/exercise-stats";
import { PRESETS } from "@/lib/presets";
import { presetBreakdown, type LibraryMuscles, type PresetBreakdown } from "@/lib/preset-stats";
import type { Muscle } from "@/lib/muscles";

export type Exercise = Database["public"]["Tables"]["exercise"]["Row"];

/** All exercises visible to the user: the shared library plus their own custom ones. */
export async function getExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Distinct exercises that the user has actually logged sets against, by name. */
export async function getLoggedExercises(): Promise<
  { exercise_id: string; exercise_name: string }[]
> {
  const stats = await getExerciseStats();
  return stats
    .map((s) => ({ exercise_id: s.exercise_id, exercise_name: s.exercise_name }))
    .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));
}

/** The lifter's most-trained lifts, most first: the pickers list them ahead of the rest. */
export async function getUsualExerciseIds(limit = 8): Promise<string[]> {
  const stats = await getExerciseStats();
  return stats
    .toSorted((a, b) => Number(b.sessions_logged) - Number(a.sessions_logged))
    .slice(0, limit)
    .map((s) => s.exercise_id);
}

/**
 * Every starter program's week at a glance (preset-stats.ts), from the shared
 * library's muscles: what the preview's charts draw.
 */
export async function getPresetBreakdowns(): Promise<Record<string, PresetBreakdown>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise")
    .select("name, primary_muscle, secondary_muscles")
    .is("user_id", null);
  if (error) throw error;
  const library: LibraryMuscles = new Map(
    (data ?? []).map((e) => [e.name, { primary: e.primary_muscle, secondary: (e.secondary_muscles ?? []) as Muscle[] }]),
  );
  return Object.fromEntries(PRESETS.map((p) => [p.id, presetBreakdown(p, library)]));
}
