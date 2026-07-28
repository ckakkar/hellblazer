import { addDays, differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { EVAL_COOLDOWN_DAYS, type EvalGate } from "@/lib/evaluation-rules";

/**
 * Whether the lifter may run a tier evaluation right now.
 *
 * Two independent gates, both enforced server-side in `evaluateTier`:
 *  1. You must have logged at least one real workout *since your last
 *     evaluation*: a finished session carrying at least one working set.
 *     Judging the same data twice tells you nothing and costs tokens.
 *  2. At most one evaluation every EVAL_COOLDOWN_DAYS days.
 *
 * The clock runs off `profile.evaluation_run_at`, which stamps on every run,
 * not `tier_evaluated_at`, which stamps only when a verdict is accepted, 
 * otherwise rejecting a verdict would reset the cooldown for free.
 */
export async function getEvalGate(): Promise<EvalGate> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profile")
    .select("evaluation_run_at")
    .maybeSingle();
  const lastRunAt = profile?.evaluation_run_at ?? null;

  // A "workout" here is a finished session with real working sets, so an
  // abandoned or empty session can't unlock an evaluation.
  const qualifying = () =>
    supabase
      .from("v_session_summary")
      .select("session_id", { count: "exact", head: true })
      .not("finished_at", "is", null)
      .gt("working_sets", 0);

  const [totalRes, newRes] = await Promise.all([
    qualifying(),
    lastRunAt ? qualifying().gt("finished_at", lastRunAt) : null,
  ]);

  const totalWorkouts = totalRes.count ?? 0;
  const newWorkouts = lastRunAt ? (newRes?.count ?? 0) : totalWorkouts;

  const nextRun = lastRunAt
    ? addDays(parseISO(lastRunAt), EVAL_COOLDOWN_DAYS)
    : null;
  const coolingDown = nextRun ? nextRun.getTime() > Date.now() : false;

  const reason: EvalGate["reason"] =
    totalWorkouts === 0
      ? "no_workout"
      : coolingDown
        ? "cooldown"
        : newWorkouts === 0
          ? "no_new_workout"
          : "ok";

  return {
    canRun: reason === "ok",
    reason,
    newWorkouts,
    totalWorkouts,
    lastRunAt,
    nextRunAt: coolingDown && nextRun ? nextRun.toISOString() : null,
  };
}

export type LiftStat = {
  exercise: string;
  bestEst1rmKg: number;
  topWeightKg: number;
  bestSetVolumeKg: number;
  sessions: number;
  firstEst1rmKg: number;
  lastEst1rmKg: number;
};

export type TrainingProfile = {
  sex: string | null;
  age: number | null;
  heightCm: number | null;
  bodyweightKg: number | null;
  totalSessions: number;
  sessionsLast28d: number;
  trainingSpanWeeks: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  totalVolumeKg: number;
  activeProgram: {
    name: string;
    currentWeek: number | null;
    totalWeeks: number;
  } | null;
  lifts: LiftStat[];
  avgWeeklySetsPerMuscle: { muscle: string; sets: number }[];
};

/**
 * Compiles a bounded but comprehensive snapshot of the user's entire training
 * history for the tier evaluation. All weights are canonical kg.
 */
export async function getTrainingProfile(): Promise<TrainingProfile> {
  const supabase = await createClient();

  const [bwRes, sessionsRes, progRes, programRes, weeklyRes, profileRes] =
    await Promise.all([
      supabase
        .from("bodyweight_log")
        .select("weight_kg")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("v_session_summary")
        .select("session_date, total_volume, working_sets")
        .order("session_date", { ascending: true }),
      supabase
        .from("v_exercise_progression")
        .select("exercise_name, best_est_1rm, top_weight, best_set_volume, session_date")
        .order("session_date", { ascending: true }),
      supabase
        .from("program")
        .select("name, duration_weeks, start_date")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("v_weekly_sets_per_muscle")
        .select("muscle, sets, week")
        .order("week", { ascending: false }),
      supabase
        .from("profile")
        .select("sex, birth_year, height_cm")
        .maybeSingle(),
    ]);

  const sessions = sessionsRes.data ?? [];
  const totalSessions = sessions.length;
  const firstSessionDate = sessions[0]?.session_date ?? null;
  const lastSessionDate = sessions[totalSessions - 1]?.session_date ?? null;
  const cutoff28 = subDays(new Date(), 28);
  const sessionsLast28d = sessions.filter(
    (s) => s.session_date && parseISO(s.session_date) >= cutoff28,
  ).length;
  const totalVolumeKg = sessions.reduce(
    (n, s) => n + Number(s.total_volume ?? 0),
    0,
  );
  const trainingSpanWeeks =
    firstSessionDate && lastSessionDate
      ? Math.max(
          1,
          Math.round(
            differenceInCalendarDays(
              parseISO(lastSessionDate),
              parseISO(firstSessionDate),
            ) / 7,
          ) + 1,
        )
      : 0;

  // Per-exercise aggregation
  const map = new Map<
    string,
    {
      best: number;
      top: number;
      bestVol: number;
      sessions: Set<string>;
      first: number;
      last: number;
    }
  >();
  for (const r of progRes.data ?? []) {
    const name = r.exercise_name;
    if (!name) continue;
    const est = Number(r.best_est_1rm ?? 0);
    const cur = map.get(name);
    if (!cur) {
      map.set(name, {
        best: est,
        top: Number(r.top_weight ?? 0),
        bestVol: Number(r.best_set_volume ?? 0),
        sessions: new Set(r.session_date ? [r.session_date] : []),
        first: est,
        last: est,
      });
    } else {
      cur.best = Math.max(cur.best, est);
      cur.top = Math.max(cur.top, Number(r.top_weight ?? 0));
      cur.bestVol = Math.max(cur.bestVol, Number(r.best_set_volume ?? 0));
      if (r.session_date) cur.sessions.add(r.session_date);
      cur.last = est; // rows are date-ascending
    }
  }
  const lifts: LiftStat[] = [...map.entries()]
    .map(([exercise, v]) => ({
      exercise,
      bestEst1rmKg: Math.round(v.best * 10) / 10,
      topWeightKg: Math.round(v.top * 10) / 10,
      bestSetVolumeKg: Math.round(v.bestVol),
      sessions: v.sessions.size,
      firstEst1rmKg: Math.round(v.first * 10) / 10,
      lastEst1rmKg: Math.round(v.last * 10) / 10,
    }))
    .sort((a, b) => b.bestEst1rmKg - a.bestEst1rmKg)
    .slice(0, 24);

  // Average weekly sets per muscle over the most recent up-to-4 weeks
  const weekly = weeklyRes.data ?? [];
  const recentWeeks = [...new Set(weekly.map((r) => r.week))].slice(0, 4);
  const weekSet = new Set(recentWeeks);
  const muscleAgg = new Map<string, number>();
  for (const r of weekly) {
    if (!r.muscle || !weekSet.has(r.week)) continue;
    muscleAgg.set(
      r.muscle,
      (muscleAgg.get(r.muscle) ?? 0) + Number(r.sets ?? 0),
    );
  }
  const weeks = Math.max(1, recentWeeks.length);
  const avgWeeklySetsPerMuscle = [...muscleAgg.entries()]
    .map(([muscle, total]) => ({
      muscle,
      sets: Math.round((total / weeks) * 10) / 10,
    }))
    .sort((a, b) => b.sets - a.sets);

  let activeProgram: TrainingProfile["activeProgram"] = null;
  if (programRes.data) {
    const p = programRes.data;
    let currentWeek: number | null = null;
    if (p.start_date) {
      const daysSince = differenceInCalendarDays(
        new Date(),
        parseISO(p.start_date),
      );
      currentWeek = Math.min(
        p.duration_weeks,
        Math.floor(Math.max(0, daysSince) / 7) + 1,
      );
    }
    activeProgram = {
      name: p.name,
      currentWeek,
      totalWeeks: p.duration_weeks,
    };
  }

  const birthYear = profileRes.data?.birth_year ?? null;
  return {
    sex: profileRes.data?.sex ?? null,
    age: birthYear ? new Date().getFullYear() - birthYear : null,
    heightCm: profileRes.data?.height_cm ?? null,
    bodyweightKg: bwRes.data?.weight_kg ?? null,
    totalSessions,
    sessionsLast28d,
    trainingSpanWeeks,
    firstSessionDate,
    lastSessionDate,
    totalVolumeKg: Math.round(totalVolumeKg),
    activeProgram,
    lifts,
    avgWeeklySetsPerMuscle,
  };
}
