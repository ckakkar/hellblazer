import { addDays, format, parseISO, startOfISOWeek, subWeeks } from "date-fns";

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

/**
 * Weeks in a row with the plan hit: `planned` workouts, or one without a
 * program. This week counts once it's hit; until then it doesn't break the
 * streak, since it isn't over. `sessionDates` holds a date per workout.
 */
export function weekStreak(sessionDates: string[], today: string, planned: number | null): number {
  const need = planned != null && planned > 0 ? planned : 1;
  const perWeek = new Map<string, number>();
  for (const date of sessionDates) {
    const week = monday(date);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  const hit = (week: Date) => (perWeek.get(format(week, "yyyy-MM-dd")) ?? 0) >= need;

  let week = startOfISOWeek(parseISO(today));
  let streak = hit(week) ? 1 : 0;
  week = subWeeks(week, 1);
  // A year of history is all the snapshot reads, so that's where it tops out.
  while (hit(week) && streak < 53) {
    streak++;
    week = subWeeks(week, 1);
  }
  return streak;
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
