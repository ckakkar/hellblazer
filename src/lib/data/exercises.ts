import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

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

/** Distinct exercises that the user has actually logged sets against. */
export async function getLoggedExercises(): Promise<
  { exercise_id: string; exercise_name: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_working_set")
    .select("exercise_id, exercise_name")
    .order("exercise_name", { ascending: true });
  if (error) throw error;

  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.exercise_id && row.exercise_name && !seen.has(row.exercise_id)) {
      seen.set(row.exercise_id, row.exercise_name);
    }
  }
  return [...seen].map(([exercise_id, exercise_name]) => ({
    exercise_id,
    exercise_name,
  }));
}
