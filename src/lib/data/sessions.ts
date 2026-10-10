import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Exercise } from "@/lib/data/exercises";
import { getExerciseStats } from "@/lib/data/exercise-stats";
import { STALE_CLOCK_MS } from "@/lib/workout-clock";

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
  /** When it started (ISO), for the banner's running clock. */
  startedAt: string;
  workingSets: number;
  exerciseCount: number;
  /** Left open past {@link STALE_CLOCK_MS}: a session someone forgot to finish,
   *  not a workout under way. It doesn't block starting another (the watch
   *  draws the same line). */
  stale: boolean;
};

/**
 * The most recent unfinished session, if any: the resume banner, and the
 * program card's "In progress" state. Cached per request, so the layout and
 * the page share one lookup.
 */
export const getActiveSession = cache(async function getActiveSession(): Promise<ActiveSession | null> {
  const supabase = await createClient();
  const { data: sess, error } = await supabase
    .from("session")
    .select("id, title, created_at")
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
    startedAt: sess.created_at,
    workingSets: Number(summary?.working_sets ?? 0),
    exerciseCount: Number(summary?.exercise_count ?? 0),
    stale: Date.now() - Date.parse(sess.created_at) > STALE_CLOCK_MS,
  };
});

/**
 * Per-session rollups for history + dashboard, most recent first. `since`
 * (yyyy-MM-dd, inclusive) bounds the read to a window, so a page that only
 * charts the last year doesn't pull a lifter's whole history.
 */
export async function getSessionSummaries(
  options: { since?: string; limit?: number } = {},
): Promise<SessionSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("v_session_summary")
    .select("*")
    .order("session_date", { ascending: false });
  if (options.since) query = query.gte("session_date", options.since);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Whether the lifter has logged any session at all, however long ago. */
export async function hasAnySession(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("session")
    .select("id", { count: "exact", head: true })
    .limit(1);
  if (error) throw error;
  return (count ?? 0) > 0;
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

/** What the template asks of each of the session's exercises. */
export type SessionTarget = {
  /** Working sets planned; null without a target. */
  sets: number | null;
  /** Seconds to rest after each set; null for the lifter's usual. */
  rest: number | null;
  /** The rep range, as the template writes it ("6-8"); null without one. */
  reps: string | null;
};

/**
 * The template's targets and rests for a session's exercises, keyed by
 * session_exercise id. Matched by position, which a swap keeps; an
 * exercise added mid-session has none.
 */
export async function getSessionTargets(
  session: SessionDetail,
): Promise<Record<string, SessionTarget>> {
  if (!session.template_id) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_exercise")
    .select("position, target_sets, rest_seconds, target_rep_range")
    .eq("template_id", session.template_id);
  if (error) throw error;
  const byPosition = new Map((data ?? []).map((t) => [t.position, t]));
  const targets: Record<string, SessionTarget> = {};
  for (const se of session.session_exercise) {
    const t = byPosition.get(se.position);
    if (t) targets[se.id] = { sets: t.target_sets, rest: t.rest_seconds, reps: t.target_rep_range };
  }
  return targets;
}

export type LastPerformance = {
  session_date: string;
  sets: { set_number: number; weight_kg: number; reps: number; rpe: number | null }[];
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
  const stats = await getExerciseStats(excludeSessionId);
  const result: Record<string, ExercisePR> = {};
  for (const s of stats) {
    result[s.exercise_id] = {
      bestWeightKg: Number(s.top_weight_kg),
      bestEst1rm: Number(s.best_est_1rm),
    };
  }
  return result;
}

/**
 * The most recent prior working-set performance for each of the given
 * exercises. Powers the inline "last: 60kg×5" target on the log screen. The
 * `last_performances()` RPC picks each exercise's latest session in Postgres,
 * so a movement not trained for months still finds its numbers (a raw read
 * of recent sets could run past the row cap before reaching it).
 */
export async function getLastPerformances(
  exerciseIds: string[],
  excludeSessionId?: string,
): Promise<Record<string, LastPerformance>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("last_performances", {
    p_exercise_ids: exerciseIds,
    ...(excludeSessionId ? { p_exclude_session: excludeSessionId } : {}),
  });
  if (error) throw error;

  const result: Record<string, LastPerformance> = {};
  for (const row of data ?? []) {
    const entry = (result[row.exercise_id] ??= {
      session_date: row.session_date,
      sets: [],
    });
    entry.sets.push({
      set_number: row.set_number,
      weight_kg: Number(row.weight_kg),
      reps: row.reps,
      rpe: row.rpe == null ? null : Number(row.rpe),
    });
  }
  return result;
}
