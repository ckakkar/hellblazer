import { format, startOfISOWeek, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { MUSCLE_CHART_ORDER, type Muscle } from "@/lib/muscles";

export type WeeklyMuscleRow =
  Database["public"]["Views"]["v_weekly_sets_per_muscle"]["Row"];
export type ProgressionRow =
  Database["public"]["Views"]["v_exercise_progression"]["Row"];

function isoWeekKey(d: Date): string {
  return format(startOfISOWeek(d), "yyyy-MM-dd");
}

export type MuscleSets = { muscle: Muscle; sets: number; volume: number };

/**
 * Sets & volume per muscle for the current ISO week, in chart order, with
 * every muscle present (zero-filled). Secondary-muscle weighting (0.5) is
 * applied in the `v_weekly_sets_per_muscle` view.
 */
export async function getCurrentWeekSetsPerMuscle(): Promise<MuscleSets[]> {
  const supabase = await createClient();
  const weekKey = isoWeekKey(new Date());
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

/** Raw weekly-per-muscle rows for the trailing `weeks` window (progress page). */
export async function getWeeklyMuscleHistory(
  weeks = 12,
): Promise<WeeklyMuscleRow[]> {
  const supabase = await createClient();
  const cutoff = isoWeekKey(subWeeks(new Date(), weeks - 1));
  const { data, error } = await supabase
    .from("v_weekly_sets_per_muscle")
    .select("*")
    .gte("week", cutoff)
    .order("week", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type WeekPoint = { week: string; volume: number; sets: number };

/**
 * Total working-set volume per ISO week (all muscles), for the dashboard
 * volume-trend line. Computed from session summaries so it reflects true
 * lifted tonnage, not muscle-weighted volume.
 */
export async function getVolumeTrend(weeks = 12): Promise<WeekPoint[]> {
  const supabase = await createClient();
  const cutoffDate = subWeeks(new Date(), weeks - 1);
  const { data, error } = await supabase
    .from("v_session_summary")
    .select("session_date, total_volume, working_sets")
    .gte("session_date", format(startOfISOWeek(cutoffDate), "yyyy-MM-dd"))
    .order("session_date", { ascending: true });
  if (error) throw error;

  const buckets = new Map<string, WeekPoint>();
  // Seed every week in the window so the line has no gaps.
  for (let i = weeks - 1; i >= 0; i--) {
    const key = isoWeekKey(subWeeks(new Date(), i));
    buckets.set(key, { week: key, volume: 0, sets: 0 });
  }
  for (const row of data ?? []) {
    if (!row.session_date) continue;
    const key = isoWeekKey(new Date(row.session_date + "T00:00:00"));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.volume += Number(row.total_volume ?? 0);
      bucket.sets += Number(row.working_sets ?? 0);
    }
  }
  return [...buckets.values()];
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
  const cutoff = isoWeekKey(subWeeks(new Date(), weeks - 1));
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
  const cutoff = isoWeekKey(subWeeks(new Date(), weeks - 1));
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
    const key = isoWeekKey(subWeeks(new Date(), i));
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
