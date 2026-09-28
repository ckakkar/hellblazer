import { addDays, format, parseISO, startOfISOWeek, subWeeks } from "date-fns";

/**
 * The fun end of the iPhone widgets (ios/App/Widgets/FighterWidget.swift,
 * StreakWidget.swift, RecordWidget.swift): the week streak, the training
 * calendar, and the latest record, worked out from what the snapshot
 * already reads (src/lib/widget-snapshot.ts). Dates are yyyy-MM-dd in the
 * lifter's calendar.
 */

/** Weeks the calendar widget shows, this one included. */
export const CALENDAR_WEEKS = 12;

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
 * The most recent new best estimated max on any lift: the first session a
 * lift reached its all-time best, when it had been trained before (a first
 * session isn't a record). `trend` is each lift's last sessions' best
 * estimated max, oldest first, as the Lift Trend widget has it.
 */
export function latestRecord(
  lifts: { id: string; name: string; bestWeight: number; bestReps: number; estimatedMax: number; sessions: number }[],
  trends: { id: string; points: { date: string; e1rm: number }[] }[],
): LatestRecord | null {
  let latest: LatestRecord | null = null;
  const byId = new Map(lifts.map((l) => [l.id, l]));
  for (const trend of trends) {
    const lift = byId.get(trend.id);
    if (!lift || trend.points.length === 0) continue;
    const best = Math.max(...trend.points.map((p) => p.e1rm));
    const at = trend.points.findIndex((p) => p.e1rm >= best - 0.05);
    // Its best is from before the sessions the trend holds: long ago.
    if (Math.abs(best - lift.estimatedMax) > 1) continue;
    const firstEver = at === 0 && lift.sessions <= trend.points.length;
    if (firstEver) continue;
    const date = trend.points[at].date;
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
