import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Exercise } from "@/lib/data/exercises";

export type Session = Database["public"]["Tables"]["session"]["Row"];
export type SessionExercise =
  Database["public"]["Tables"]["session_exercise"]["Row"];
export type WorkoutSet = Database["public"]["Tables"]["set"]["Row"];
export type SessionSummary =
  Database["public"]["Views"]["v_session_summary"]["Row"];

export type SessionExerciseFull = SessionExercise & {
  exercise: Exercise | null;
  set: WorkoutSet[];
};

export type SessionDetail = Session & {
  session_exercise: SessionExerciseFull[];
};

/** Per-session rollups for history + dashboard, most recent first. */
export async function getSessionSummaries(
  limit?: number,
): Promise<SessionSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("v_session_summary")
    .select("*")
    .order("session_date", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Full session with its exercises and every set (warmups included). */
export async function getSessionDetail(
  id: string,
): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session")
    .select("*, session_exercise(*, exercise(*), set(*))")
    .eq("id", id)
    .order("position", {
      ascending: true,
      referencedTable: "session_exercise",
    })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const detail = data as unknown as SessionDetail;
  // Sets aren't orderable via nested `.order` here, so sort in memory.
  for (const se of detail.session_exercise) {
    se.set.sort((a, b) => a.set_number - b.set_number);
  }
  return detail;
}

export type LastPerformance = {
  session_date: string;
  sets: { set_number: number; weight_kg: number; reps: number }[];
};

/**
 * The most recent prior working-set performance for each of the given
 * exercises — powers the inline "last: 60kg×5" target on the log screen.
 * One query, grouped in memory by exercise → latest session.
 */
export async function getLastPerformances(
  exerciseIds: string[],
  excludeSessionId?: string,
): Promise<Record<string, LastPerformance>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();

  let query = supabase
    .from("v_working_set")
    .select("exercise_id, session_id, session_date, set_number, weight_kg, reps")
    .in("exercise_id", exerciseIds)
    .order("session_date", { ascending: false })
    .order("set_number", { ascending: true });
  if (excludeSessionId) query = query.neq("session_id", excludeSessionId);

  const { data, error } = await query;
  if (error) throw error;

  const result: Record<string, LastPerformance> = {};
  for (const row of data ?? []) {
    if (
      !row.exercise_id ||
      !row.session_date ||
      row.weight_kg == null ||
      row.reps == null ||
      row.set_number == null
    )
      continue;
    const existing = result[row.exercise_id];
    // Rows are session_date DESC, so the first date we see per exercise is the
    // latest; keep only sets from that session.
    if (!existing) {
      result[row.exercise_id] = {
        session_date: row.session_date,
        sets: [
          { set_number: row.set_number, weight_kg: row.weight_kg, reps: row.reps },
        ],
      };
    } else if (existing.session_date === row.session_date) {
      existing.sets.push({
        set_number: row.set_number,
        weight_kg: row.weight_kg,
        reps: row.reps,
      });
    }
  }
  return result;
}
