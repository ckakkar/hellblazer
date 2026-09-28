import { addDays, format, parseISO, startOfISOWeek } from "date-fns";
import type { createServiceClient } from "@/lib/supabase/service";
import { MUSCLE_LABEL, WEAK_POINTS } from "@/lib/muscles";

type Svc = NonNullable<ReturnType<typeof createServiceClient>>;

/**
 * The Sunday recap: the lifter's week in one push, from the daily cron
 * (src/app/api/cron/reminders). Workouts against the plan, working sets,
 * new bests, and the weak-point muscle furthest under the 10-set band.
 * Only counts, no weights: the unit lives in a cookie the cron can't read.
 */

/** Below this many sets a week, a weak point gets named. */
const SET_BAND_FLOOR = 10;

/**
 * Which week (its Monday) to recap now, or null. The cron runs once a day
 * at 16:00 UTC, which is Sunday evening in India but Monday small hours in
 * Tokyo and Sunday morning in California: Sunday from noon on, or Monday
 * before noon, recaps the week just ending.
 */
export function recapWeek(localDate: string, localHour: number): string | null {
  const day = parseISO(localDate).getDay();
  const recapping =
    day === 0 && localHour >= 12 ? localDate : day === 1 && localHour < 12 ? format(addDays(parseISO(localDate), -1), "yyyy-MM-dd") : null;
  return recapping ? format(startOfISOWeek(parseISO(recapping)), "yyyy-MM-dd") : null;
}

export type RecapFacts = {
  sessions: number;
  /** Days a week in the active program; null without one. */
  planned: number | null;
  sets: number;
  /** Lifts with a new heaviest set this week. */
  records: string[];
  /** The weak point furthest under the band, if any is under it. */
  weakest: { label: string; sets: number } | null;
};

/** The recap's facts, and what the weekly share card adds: the week's volume and each new best's weight. */
export type WeekFacts = RecapFacts & {
  volumeKg: number;
  /** Heaviest first. */
  bests: { name: string; topKg: number }[];
};

function list(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

export function recapMessage(f: RecapFacts): { title: string; body: string } {
  if (f.sessions === 0) {
    return {
      title: "Your week in Fatty",
      body: "No workouts logged this week. A new week starts tomorrow.",
    };
  }
  const workouts = `${f.sessions} ${f.sessions === 1 ? "workout" : "workouts"}`;
  const title = f.planned ? `${f.sessions} of ${f.planned} workouts this week` : `${workouts} this week`;
  const parts = [`${f.sets} working ${f.sets === 1 ? "set" : "sets"}.`];
  if (f.records.length > 0) {
    parts.push(`New ${f.records.length === 1 ? "best" : "bests"} on ${list(f.records)}.`);
  }
  if (f.weakest) {
    parts.push(`${f.weakest.label} is lowest at ${f.weakest.sets} ${f.weakest.sets === 1 ? "set" : "sets"}.`);
  } else {
    parts.push("Every weak point hit its sets.");
  }
  return { title, body: parts.join(" ") };
}

/** The week's facts for one lifter, `weekStart` a Monday (yyyy-MM-dd). */
export async function gatherRecap(svc: Svc, userId: string, weekStart: string): Promise<WeekFacts> {
  const weekEnd = format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const [summaries, program, thisWeek, muscles] = await Promise.all([
    svc
      .from("v_session_summary")
      .select("working_sets, total_volume")
      .eq("user_id", userId)
      .gte("session_date", weekStart)
      .lt("session_date", weekEnd)
      .not("finished_at", "is", null)
      .gt("working_sets", 0),
    svc
      .from("program")
      .select("program_day(id)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    svc
      .from("v_exercise_progression")
      .select("exercise_id, exercise_name, top_weight")
      .eq("user_id", userId)
      .gte("session_date", weekStart)
      .lt("session_date", weekEnd),
    svc
      .from("v_weekly_sets_per_muscle")
      .select("muscle, sets")
      .eq("user_id", userId)
      .eq("week", weekStart),
  ]);
  for (const r of [summaries, program, thisWeek, muscles]) if (r.error) throw r.error;

  // A best counts when it beats everything before this week, not a first try.
  const bestThisWeek = new Map<string, { name: string; top: number }>();
  for (const row of thisWeek.data ?? []) {
    if (!row.exercise_id) continue;
    const top = Number(row.top_weight ?? 0);
    const seen = bestThisWeek.get(row.exercise_id);
    if (!seen || top > seen.top) bestThisWeek.set(row.exercise_id, { name: row.exercise_name ?? "a lift", top });
  }
  const bests: WeekFacts["bests"] = [];
  if (bestThisWeek.size > 0) {
    const { data: before, error } = await svc
      .from("v_exercise_progression")
      .select("exercise_id, top_weight")
      .eq("user_id", userId)
      .in("exercise_id", [...bestThisWeek.keys()])
      .lt("session_date", weekStart);
    if (error) throw error;
    const previous = new Map<string, number>();
    for (const row of before ?? []) {
      if (!row.exercise_id) continue;
      previous.set(row.exercise_id, Math.max(previous.get(row.exercise_id) ?? 0, Number(row.top_weight ?? 0)));
    }
    for (const [id, best] of bestThisWeek) {
      const prior = previous.get(id);
      if (prior != null && best.top > prior) bests.push({ name: best.name, topKg: best.top });
    }
  }

  const setsByMuscle = new Map((muscles.data ?? []).map((m) => [m.muscle, Number(m.sets ?? 0)]));
  const weakest = WEAK_POINTS.map((m) => ({ label: MUSCLE_LABEL[m], sets: Math.round(setsByMuscle.get(m) ?? 0) }))
    .filter((m) => m.sets < SET_BAND_FLOOR)
    .sort((a, b) => a.sets - b.sets)[0];

  const rows = summaries.data ?? [];
  return {
    sessions: rows.length,
    planned: program.data?.program_day?.length || null,
    sets: rows.reduce((n, s) => n + Number(s.working_sets ?? 0), 0),
    records: bests.map((b) => b.name),
    weakest: weakest ?? null,
    volumeKg: rows.reduce((n, s) => n + Number(s.total_volume ?? 0), 0),
    bests: [...bests].sort((a, b) => b.topKg - a.topKg),
  };
}
