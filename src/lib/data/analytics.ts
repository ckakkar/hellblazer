import { format, startOfISOWeek, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { MUSCLE_CHART_ORDER, type Muscle } from "@/lib/muscles";

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
 * first. Powers the Progress "1RM board". One pass over `v_working_set`.
 */
export async function getAllExercise1RMs(): Promise<Exercise1RM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_working_set")
    .select("exercise_id, exercise_name, primary_muscle, weight_kg, reps, est_1rm");
  if (error) throw error;

  const byExercise = new Map<string, Exercise1RM>();
  for (const r of data ?? []) {
    if (!r.exercise_id) continue;
    const e1rm = Number(r.est_1rm ?? 0);
    const w = Number(r.weight_kg ?? 0);
    const reps = Number(r.reps ?? 0);
    const cur = byExercise.get(r.exercise_id);
    if (!cur) {
      byExercise.set(r.exercise_id, {
        exerciseId: r.exercise_id,
        name: r.exercise_name ?? "Exercise",
        primaryMuscle: (r.primary_muscle as Muscle) ?? "chest",
        bestEst1rm: e1rm,
        bestWeightKg: w,
        bestReps: reps,
        topWeightKg: w,
      });
    } else {
      if (e1rm > cur.bestEst1rm) {
        cur.bestEst1rm = e1rm;
        cur.bestWeightKg = w;
        cur.bestReps = reps;
      }
      if (w > cur.topWeightKg) cur.topWeightKg = w;
    }
  }
  return [...byExercise.values()].sort((a, b) => b.bestEst1rm - a.bestEst1rm);
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
