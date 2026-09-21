import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { getExerciseStats } from "@/lib/data/exercise-stats";

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
