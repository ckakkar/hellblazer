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

export type ActiveSession = {
  id: string;
  title: string | null;
  workingSets: number;
  exerciseCount: number;
};

/** The most recent unfinished session, if any — powers the resume banner. */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const supabase = await createClient();
  const { data: sess, error } = await supabase
    .from("session")
    .select("id, title")
    .is("finished_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!sess) return null;

  const { data: summary } = await supabase
    .from("v_session_summary")
    .select("working_sets, exercise_count")
    .eq("session_id", sess.id)
    .maybeSingle();

  return {
    id: sess.id,
    title: sess.title,
    workingSets: Number(summary?.working_sets ?? 0),
    exerciseCount: Number(summary?.exercise_count ?? 0),
  };
}

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

export type ExercisePR = { bestWeightKg: number; bestEst1rm: number };

/**
 * All-time working-set bests per exercise, drawn from PRIOR sessions only (the
 * current session is excluded so re-editing today's numbers can't inflate the
 * baseline). Powers the mid-workout "Removal" PR callout. Keyed by exercise_id;
 * every exercise the user has ever trained is included, so movements added or
 * swapped in mid-session already have their baseline client-side.
 */
export async function getExercisePRs(
  excludeSessionId: string,
): Promise<Record<string, ExercisePR>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_working_set")
    .select("exercise_id, weight_kg, est_1rm")
    .neq("session_id", excludeSessionId);
  if (error) throw error;

  const result: Record<string, ExercisePR> = {};
  for (const row of data ?? []) {
    if (!row.exercise_id) continue;
    const w = Number(row.weight_kg ?? 0);
    const e = Number(row.est_1rm ?? 0);
    const cur = result[row.exercise_id];
    if (!cur) {
      result[row.exercise_id] = { bestWeightKg: w, bestEst1rm: e };
    } else {
      if (w > cur.bestWeightKg) cur.bestWeightKg = w;
      if (e > cur.bestEst1rm) cur.bestEst1rm = e;
    }
  }
  return result;
}

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
