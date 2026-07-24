import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/database.types";

export type Exercise = Database["public"]["Tables"]["exercise"]["Row"];

/**
 * The shared, seeded exercise library (`user_id is null`) — identical for every
 * user and rarely changed (only via seeding), so it's cached for an hour rather
 * than re-queried on every page that shows a picker. Read through a cookie-less
 * anon client so it's safe inside `unstable_cache`.
 */
const getGlobalExercises = unstable_cache(
  async (): Promise<Exercise[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("exercise")
      .select("*")
      .is("user_id", null)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  ["global-exercise-library"],
  { revalidate: 3600, tags: ["exercise-library"] },
);

/**
 * All exercises visible to the user: the cached shared library plus their own
 * custom movements (fetched fresh, since those change on create/delete).
 */
export async function getExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const [globalLib, customRes] = await Promise.all([
    getGlobalExercises(),
    supabase
      .from("exercise")
      .select("*")
      .not("user_id", "is", null)
      .order("name", { ascending: true }),
  ]);
  if (customRes.error) throw customRes.error;
  const custom = customRes.data ?? [];
  if (custom.length === 0) return globalLib;
  return [...globalLib, ...custom].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
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
