import { format, parseISO, startOfISOWeek, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/settings";
import { getExerciseStats } from "@/lib/data/exercise-stats";
import { MUSCLE_CHART_ORDER, type Muscle } from "@/lib/muscles";

function isoWeekKey(d: Date): string {
  return format(startOfISOWeek(d), "yyyy-MM-dd");
}

/** Today in the lifter's timezone, since the view buckets by local session date. */
async function lifterNow(): Promise<Date> {
  return parseISO(await getToday());
}

export type MuscleSets = { muscle: Muscle; sets: number; volume: number };

/**
 * Sets & volume per muscle for the current ISO week, in chart order, with
 * every muscle present (zero-filled). Secondary-muscle weighting (0.5) is
 * applied in the `v_weekly_sets_per_muscle` view.
 */
export async function getCurrentWeekSetsPerMuscle(): Promise<MuscleSets[]> {
  const supabase = await createClient();
  const weekKey = isoWeekKey(await lifterNow());
  const { data, error } = await supabase
    .from("v_weekly_sets_per_muscle")
    .select("muscle, sets, volume")
    .eq("week", weekKey);
  if (error) throw error;

  const byMuscle = new Map<Muscle, { sets: number; volume: number }>();
  for (const row of data ?? []) {
    if (!row.muscle) continue;
    byMuscle.set(row.muscle, {
      sets: Number(row.sets ?? 0),
      volume: Number(row.volume ?? 0),
    });
  }
  return MUSCLE_CHART_ORDER.map((muscle) => ({
    muscle,
    sets: byMuscle.get(muscle)?.sets ?? 0,
    volume: byMuscle.get(muscle)?.volume ?? 0,
  }));
}

export type MuscleBalanceRow = { muscle: Muscle; sets: number; volume: number };

/**
 * Per-muscle balance over the trailing `weeks` window: average weekly sets and
 * total volume for every muscle (zero-filled, chart order). Powers the muscle
 * radar and the volume-share donut. Secondary-muscle 0.5 weighting is baked in
 * by the view.
 */
export async function getMuscleBalance(weeks = 4): Promise<MuscleBalanceRow[]> {
  const supabase = await createClient();
  const cutoff = isoWeekKey(subWeeks(await lifterNow(), weeks - 1));
  const { data, error } = await supabase
    .from("v_weekly_sets_per_muscle")
    .select("muscle, sets, volume")
    .gte("week", cutoff);
  if (error) throw error;

  const agg = new Map<Muscle, { sets: number; volume: number }>();
  for (const r of data ?? []) {
    if (!r.muscle) continue;
    const cur = agg.get(r.muscle) ?? { sets: 0, volume: 0 };
    cur.sets += Number(r.sets ?? 0);
    cur.volume += Number(r.volume ?? 0);
    agg.set(r.muscle, cur);
  }
  return MUSCLE_CHART_ORDER.map((muscle) => {
    const hit = agg.get(muscle);
    return {
      muscle,
      sets: hit ? Math.round((hit.sets / weeks) * 10) / 10 : 0,
      volume: hit?.volume ?? 0,
    };
  });
}

export type MuscleWeekPoint = { week: string; sets: number; volume: number };

/** Zero-filled weekly sets & volume series for one muscle (progress muscle tab). */
export async function getMuscleWeeklySeries(
  muscle: Muscle,
  weeks = 12,
): Promise<MuscleWeekPoint[]> {
  const supabase = await createClient();
  const now = await lifterNow();
  const cutoff = isoWeekKey(subWeeks(now, weeks - 1));
  const { data, error } = await supabase
    .from("v_weekly_sets_per_muscle")
    .select("week, sets, volume")
    .eq("muscle", muscle)
    .gte("week", cutoff)
    .order("week", { ascending: true });
  if (error) throw error;

  const byWeek = new Map<string, { sets: number; volume: number }>();
  for (const row of data ?? []) {
    if (!row.week) continue;
    byWeek.set(row.week, {
      sets: Number(row.sets ?? 0),
      volume: Number(row.volume ?? 0),
    });
  }
  const out: MuscleWeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const key = isoWeekKey(subWeeks(now, i));
    const hit = byWeek.get(key);
    out.push({ week: key, sets: hit?.sets ?? 0, volume: hit?.volume ?? 0 });
  }
  return out;
}

export type ExercisePR = {
  topWeight: number;
  bestEst1rm: number;
  bestSetVolume: number;
  sessionsLogged: number;
};

export type ExerciseProgression = {
  points: { date: string; est1rm: number; volume: number; topWeight: number }[];
  pr: ExercisePR;
};

export type Exercise1RM = {
  exerciseId: string;
  name: string;
  primaryMuscle: Muscle;
  bestEst1rm: number; // kg
  bestWeightKg: number; // load of the set that produced the best est. 1RM
  bestReps: number; // reps of that set
  topWeightKg: number; // heaviest load ever handled (any rep count)
};

/**
 * Every exercise the user has logged a working set against, with their all-time
 * best estimated 1RM (Epley) and the set that produced it, ranked strongest
 * first. Powers the Progress "1RM board".
 */
export async function getAllExercise1RMs(): Promise<Exercise1RM[]> {
  const stats = await getExerciseStats();
  return stats
    .map((s) => ({
      exerciseId: s.exercise_id,
      name: s.exercise_name,
      primaryMuscle: s.primary_muscle,
      bestEst1rm: Number(s.best_est_1rm),
      bestWeightKg: Number(s.best_weight_kg),
      bestReps: s.best_reps,
      topWeightKg: Number(s.top_weight_kg),
    }))
    .sort((a, b) => b.bestEst1rm - a.bestEst1rm);
}

/** 1RM progression, volume-per-session and PRs for one exercise. */
export async function getExerciseProgression(
  exerciseId: string,
): Promise<ExerciseProgression> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_exercise_progression")
    .select("*")
    .eq("exercise_id", exerciseId)
    .order("session_date", { ascending: true });
  if (error) throw error;

  const points = (data ?? [])
    .filter((r) => r.session_date)
    .map((r) => ({
      date: r.session_date as string,
      est1rm: Number(r.best_est_1rm ?? 0),
      volume: Number(r.volume ?? 0),
      topWeight: Number(r.top_weight ?? 0),
    }));

  const pr: ExercisePR = {
    topWeight: Math.max(0, ...points.map((p) => p.topWeight)),
    bestEst1rm: Math.max(0, ...points.map((p) => p.est1rm)),
    bestSetVolume: Math.max(
      0,
      ...(data ?? []).map((r) => Number(r.best_set_volume ?? 0)),
    ),
    sessionsLogged: points.length,
  };
  return { points, pr };
}

export type LiftTrend = {
  exerciseId: string;
  name: string;
  /** Best estimated 1RM per session in the window, oldest first (kg). */
  points: { date: string; e1rm: number }[];
  /** The latest session's best estimated 1RM (kg). */
  current: number;
  /** Change from the first to the latest session in the window, in %. */
  changePct: number | null;
};

/**
 * The lifter's most-trained lifts and where their estimated 1RM has gone
 * over the last `weeks`. Picks the lifts from the `exercise_stats()` RPC
 * (cached per request), then reads just those lifts' per-session bests in
 * one query.
 */
export async function getTopLiftTrends(limit = 4, weeks = 12): Promise<LiftTrend[]> {
  const stats = await getExerciseStats();
  if (stats.length === 0) return [];
  const supabase = await createClient();

  // Compounds first: a strength view should lead with the bench, not the
  // lateral raise you happen to do three times a week. Then by how often
  // it's trained, then by how heavy.
  const candidates = [...stats].sort((a, b) => b.sessions_logged - a.sessions_logged).slice(0, 16);
  const { data: kinds } = await supabase
    .from("exercise")
    .select("id, mechanic")
    .in(
      "id",
      candidates.map((c) => c.exercise_id),
    );
  const compound = new Set((kinds ?? []).filter((k) => k.mechanic === "compound").map((k) => k.id));
  const top = candidates
    .sort(
      (a, b) =>
        Number(compound.has(b.exercise_id)) - Number(compound.has(a.exercise_id)) ||
        b.sessions_logged - a.sessions_logged ||
        b.best_est_1rm - a.best_est_1rm,
    )
    .slice(0, limit);

  const since = format(subWeeks(await lifterNow(), weeks), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("v_exercise_progression")
    .select("exercise_id, session_date, best_est_1rm")
    .in(
      "exercise_id",
      top.map((t) => t.exercise_id),
    )
    .gte("session_date", since)
    .order("session_date", { ascending: true });
  if (error) throw error;

  return top.map((t) => {
    const points = (data ?? [])
      .filter((r) => r.exercise_id === t.exercise_id && r.session_date)
      .map((r) => ({ date: r.session_date as string, e1rm: Number(r.best_est_1rm ?? 0) }));
    const first = points[0]?.e1rm ?? 0;
    const current = points[points.length - 1]?.e1rm ?? Number(t.last_est_1rm ?? 0);
    return {
      exerciseId: t.exercise_id,
      name: t.exercise_name,
      points,
      current,
      changePct: points.length > 1 && first > 0 ? Math.round(((current - first) / first) * 100) : null,
    };
  });
}

export type RepRangeWeek = {
  week: string;
  strength: number;
  hypertrophy: number;
  endurance: number;
};

/**
 * Working sets per ISO week split by rep range: 1-5 (strength), 6-12
 * (hypertrophy), 13+ (endurance), for the last `weeks` weeks including this
 * one, zero-filled. Counted in Postgres (`rep_range_weekly()`).
 */
export async function getRepRangeWeeks(weeks = 8): Promise<RepRangeWeek[]> {
  const supabase = await createClient();
  const now = await lifterNow();
  const first = startOfISOWeek(subWeeks(now, weeks - 1));
  const { data, error } = await supabase.rpc("rep_range_weekly", {
    p_since: format(first, "yyyy-MM-dd"),
  });
  if (error) throw error;
  const byWeek = new Map((data ?? []).map((r) => [r.week, r]));
  return Array.from({ length: weeks }).map((_, i) => {
    const key = isoWeekKey(subWeeks(now, weeks - 1 - i));
    const r = byWeek.get(key);
    return {
      week: key,
      strength: Number(r?.strength ?? 0),
      hypertrophy: Number(r?.hypertrophy ?? 0),
      endurance: Number(r?.endurance ?? 0),
    };
  });
}

export type RecentRecord = {
  exerciseId: string;
  name: string;
  sessionId: string;
  date: string;
  kind: "weight" | "e1rm";
  /** The new best (kg). */
  value: number;
  /** What it beat (kg). */
  previous: number;
};

/** The lifter's latest personal records, newest first (`recent_records()`). */
export async function getRecentRecords(limit = 5): Promise<RecentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recent_records", { p_limit: limit });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    exerciseId: r.exercise_id,
    name: r.exercise_name,
    sessionId: r.session_id,
    date: r.session_date,
    kind: r.kind === "weight" ? "weight" : "e1rm",
    value: Number(r.value),
    previous: Number(r.previous),
  }));
}
