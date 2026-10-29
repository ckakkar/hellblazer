import { addDays, format, parseISO, startOfISOWeek, subWeeks } from "date-fns";
import { readPauses } from "@/lib/program-week";

/**
 * The fun end of the iPhone and iPad widgets (ios/App/Widgets/FighterWidget.swift,
 * StreakWidget.swift, RecordWidget.swift): the week streak, the training
 * calendar, and the latest record, worked out from what the snapshot
 * already reads (src/lib/widget-snapshot.ts). Dates are yyyy-MM-dd in the
 * lifter's calendar.
 */

/** Weeks the calendar widgets can show, this one included: the medium
 *  Streak shows the last 12, the iPad's extra large all 26. */
export const CALENDAR_WEEKS = 26;

const monday = (date: string) => format(startOfISOWeek(parseISO(date)), "yyyy-MM-dd");

/** A workout toward the streak: its day, and the program it was started from (null: freeform). */
export type StreakWorkout = { date: string; programId: string | null };

/** What a program asked of a week: its days, and the stretches it was paused (yyyy-MM-dd, inclusive). */
export type StreakPlan = { days: number; paused: { from: string; to: string }[] };

/**
 * Weeks in a row with the plan hit. Each week is held to the plan it was
 * trained under: the program of its latest workout started from one, or the
 * one before it (a week of freeform workouts keeps the plan you were on),
 * and this week to the plan you're on now. So switching plans never rewrites
 * a week already earned; the new target counts from the week you switch. A
 * week under no plan wants one workout. A week its plan was paused for, start
 * to end, is passed over: it neither counts nor breaks the streak. This week
 * counts once it's hit; until then it doesn't break the streak, since it
 * isn't over.
 */
export function weekStreak(
  workouts: StreakWorkout[],
  today: string,
  plans: ReadonlyMap<string, StreakPlan>,
  current: string | null,
): number {
  const perWeek = new Map<string, number>();
  for (const w of workouts) perWeek.set(monday(w.date), (perWeek.get(monday(w.date)) ?? 0) + 1);
  // Workouts from a program, latest first: a week's plan is the first at or before its end.
  const fromPlans = workouts
    .filter((w): w is { date: string; programId: string } => w.programId !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const thisWeek = startOfISOWeek(parseISO(today));
  const planOf = (week: Date): string | null => {
    if (week.getTime() === thisWeek.getTime() && current) return current;
    const end = format(addDays(week, 6), "yyyy-MM-dd");
    return fromPlans.find((w) => w.date <= end)?.programId ?? null;
  };
  const verdict = (week: Date): "hit" | "paused" | "missed" => {
    const key = format(week, "yyyy-MM-dd");
    const id = planOf(week);
    const plan = id ? plans.get(id) : undefined;
    const end = format(addDays(week, 6), "yyyy-MM-dd");
    if (plan?.paused.some((p) => p.from <= key && p.to >= end)) return "paused";
    const need = plan && plan.days > 0 ? plan.days : 1;
    return (perWeek.get(key) ?? 0) >= need ? "hit" : "missed";
  };

  let streak = 0;
  let week = thisWeek;
  if (verdict(week) === "hit") streak = 1;
  // A year of history is all the snapshot reads, so that's where it tops out.
  for (let looked = 0; looked < 60 && streak < 53; looked++) {
    week = subWeeks(week, 1);
    const v = verdict(week);
    if (v === "missed") break;
    if (v === "hit") streak++;
  }
  return streak;
}

/** A program's pauses as the streak reads them: each stretch, and one still going (to `today`). */
export function streakPlan(
  program: { paused_at: string | null; pauses: unknown; program_day: unknown[] },
  today: string,
): StreakPlan {
  const paused = readPauses(program.pauses).map((p) => ({
    from: p.at,
    to: format(addDays(parseISO(p.at), p.days - 1), "yyyy-MM-dd"),
  }));
  if (program.paused_at) paused.push({ from: program.paused_at.slice(0, 10), to: today });
  return { days: program.program_day.length, paused };
}

/** The days trained in the calendar's weeks, oldest first, each once. */
export function trainingDays(sessionDates: string[], today: string): string[] {
  const from = format(subWeeks(startOfISOWeek(parseISO(today)), CALENDAR_WEEKS - 1), "yyyy-MM-dd");
  const to = format(addDays(startOfISOWeek(parseISO(today)), 6), "yyyy-MM-dd");
  return [...new Set(sessionDates.filter((d) => d >= from && d <= to))].sort();
}

export type LatestRecord = {
  name: string;
  /** The set behind the best estimated max, display unit. */
  weight: number;
  reps: number;
  /** Estimated max, display unit. */
  estimatedMax: number;
  /** When it was set. */
  date: string;
};

/**
 * The most recent new best estimated max on any lift: the session a lift
 * first reached its all-time best, when it had been trained before (a first
 * session isn't a record). `records` comes from the whole history
 * (lift_record_dates), so a best reached long ago and only matched lately
 * keeps its own date, and the set shown is the one behind that best.
 */
export function latestRecord(
  lifts: { id: string; name: string; bestWeight: number; bestReps: number; estimatedMax: number }[],
  records: { id: string; date: string; sessionsBefore: number }[],
): LatestRecord | null {
  let latest: LatestRecord | null = null;
  const byId = new Map(lifts.map((l) => [l.id, l]));
  for (const record of records) {
    const lift = byId.get(record.id);
    if (!lift || record.sessionsBefore === 0) continue;
    const { date } = record;
    if (!latest || date > latest.date || (date === latest.date && lift.estimatedMax > latest.estimatedMax)) {
      latest = {
        name: lift.name,
        weight: lift.bestWeight,
        reps: lift.bestReps,
        estimatedMax: lift.estimatedMax,
        date,
      };
    }
  }
  return latest;
}
