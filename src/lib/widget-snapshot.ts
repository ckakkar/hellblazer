import { format, parseISO, startOfISOWeek } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getProgramProgress, PROGRAM_SELECT, type ProgramWithDays } from "@/lib/data/programs";
import { dateInTimeZone } from "@/lib/local-date";
import { CHART_HIDDEN_MUSCLES, isWeakPoint, MUSCLE_CHART_ORDER, MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import type { WidgetSnapshot } from "@/lib/native-plugins";
import { toDisplayWeight, type Unit } from "@/lib/units";

/** The most-trained lifts Siri, Spotlight and the Lift Trend widget know about. */
const MAX_LIFTS = 40;
/** Estimated-max history for the Lift Trend widget: every lift it can pick, 16 sessions each. */
const TREND_LIFTS = MAX_LIFTS;
const TREND_POINTS = 16;

/**
 * Everything the iPhone app's widgets, Siri and Spotlight read, in one place
 * (ios/App/Shared/WidgetSnapshot.swift). Two callers:
 *
 * - the dashboard in the app (getNativeSnapshot), with the lifter's own client;
 * - /api/device/snapshot, which a silent push sends the phone to after a
 *   workout is finished anywhere, with the service role.
 *
 * So every query is scoped to `userId` explicitly, and the two functions it
 * calls take the lifter as an argument (honoured only without a signed-in user).
 * Weights are in the display unit; dates in the lifter's calendar.
 */
export async function buildWidgetSnapshot(
  db: SupabaseClient<Database>,
  { userId, unit, timeZone }: { userId: string; unit: Unit; timeZone: string },
): Promise<Omit<WidgetSnapshot, "updatedAt">> {
  const today = dateInTimeZone(new Date(), timeZone);
  const weekStart = format(startOfISOWeek(parseISO(today)), "yyyy-MM-dd");

  const [week, program, muscles, stats, trendRows] = await Promise.all([
    db
      .from("v_session_summary")
      .select("working_sets")
      .eq("user_id", userId)
      .gte("session_date", weekStart)
      .then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
    db
      .from("program")
      .select(PROGRAM_SELECT)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("position", { ascending: true, referencedTable: "program_day" })
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as ProgramWithDays | null) ?? null;
      }),
    db
      .from("v_weekly_sets_per_muscle")
      .select("muscle, sets")
      .eq("user_id", userId)
      .eq("week", weekStart)
      .then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
    db.rpc("exercise_stats", { p_user: userId }).then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    }),
    db
      .rpc("lift_trends", { p_user: userId, p_lifts: TREND_LIFTS, p_points: TREND_POINTS })
      .then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
  ]);

  const progress = program ? await getProgramProgress(program, { supabase: db, timeZone }) : null;
  const nextTemplate = progress && !progress.isCompleted ? progress.nextDay?.workout_template : null;

  // The days /log offers: the active program's, else every template.
  const workouts: NonNullable<WidgetSnapshot["workouts"]> = [];
  if (program) {
    const seen = new Set<string>();
    for (const day of program.program_day) {
      const t = day.workout_template;
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      workouts.push({ templateId: t.id, label: t.day_label || t.name });
    }
  } else {
    const { data, error } = await db
      .from("workout_template")
      .select("id, name, day_label")
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error) throw error;
    for (const t of data ?? []) workouts.push({ templateId: t.id, label: t.day_label || t.name });
  }

  const setsByMuscle = new Map(muscles.map((m) => [m.muscle, Number(m.sets ?? 0)]));

  const trends = new Map<string, NonNullable<WidgetSnapshot["trends"]>[number]>();
  for (const row of trendRows) {
    const trend = trends.get(row.exercise_id) ?? { id: row.exercise_id, name: row.exercise_name, points: [] };
    trend.points.push({
      date: row.session_date,
      e1rm: Math.round(toDisplayWeight(Number(row.best_est_1rm), unit) * 10) / 10,
    });
    trends.set(row.exercise_id, trend);
  }

  const lifts = [...stats]
    .sort((a, b) => Number(b.sessions_logged) - Number(a.sessions_logged))
    .slice(0, MAX_LIFTS);
  const liftOrder = new Map(lifts.map((l, i) => [l.exercise_id, i]));

  return {
    nextBout: nextTemplate ? nextTemplate.day_label || nextTemplate.name : null,
    nextTemplateId: nextTemplate?.id ?? null,
    programName: program?.name ?? null,
    sessionsThisWeek: week.length,
    sessionsPlanned: progress?.daysPerWeek ?? null,
    setsThisWeek: week.reduce((n, s) => n + Number(s.working_sets ?? 0), 0),
    weekStart,
    unit,
    workouts,
    lifts: lifts.map((s) => ({
        id: s.exercise_id,
        name: s.exercise_name,
        bestWeight: toDisplayWeight(Number(s.best_weight_kg), unit),
        bestReps: Number(s.best_reps),
        estimatedMax: Math.round(toDisplayWeight(Number(s.best_est_1rm), unit)),
      })),
    muscles: MUSCLE_CHART_ORDER.filter((m) => !CHART_HIDDEN_MUSCLES.has(m)).map((m: Muscle) => ({
      key: m,
      label: MUSCLE_LABEL[m],
      sets: Math.round((setsByMuscle.get(m) ?? 0) * 10) / 10,
      weak: isWeakPoint(m),
    })),
    // Most-trained first: the Lift Trend widget shows the first until one's picked.
    trends: [...trends.values()].sort(
      (a, b) => (liftOrder.get(a.id) ?? Infinity) - (liftOrder.get(b.id) ?? Infinity),
    ),
  };
}
