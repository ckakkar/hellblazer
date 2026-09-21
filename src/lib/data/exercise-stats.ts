import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type ExerciseStat =
  Database["public"]["Functions"]["exercise_stats"]["Returns"][number];

/**
 * One row per exercise the lifter has logged working sets against: the best
 * est. 1RM and the set behind it, heaviest load, best single-set volume,
 * sessions logged, and the first and latest session bests. Aggregated in
 * Postgres by the `exercise_stats()` RPC: reading raw sets and summing here
 * stopped at PostgREST's row cap (1,000 by default) and went quietly wrong
 * past it. Cached per request, since /progress needs it twice.
 */
export const getExerciseStats = cache(
  async (excludeSessionId?: string): Promise<ExerciseStat[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "exercise_stats",
      excludeSessionId ? { p_exclude_session: excludeSessionId } : {},
    );
    if (error) throw error;
    return data ?? [];
  },
);
