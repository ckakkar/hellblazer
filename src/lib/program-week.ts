import { addDays, format, parseISO } from "date-fns";

/**
 * Which workouts and skips count toward a program's current week.
 *
 * A week is seven calendar days from the block's start date. Pausing stops
 * that calendar: resuming moves the start date on by the days spent paused.
 * Moving the start alone would push the week past anything done before the
 * pause (one day done, pause, resume: zero done, back to day 1), so each
 * resume is also recorded (`pauses`), and a workout from before a pause
 * counts as if it had happened that many days later: where the stopped
 * calendar has it. Restarting a block clears the record and stamps
 * `restarted_at`; nothing from before that counts, even from earlier today.
 */

export type Pause = {
  /** The day it was paused (yyyy-MM-dd, the lifter's calendar). */
  at: string;
  /** Calendar days it stayed paused. */
  days: number;
};

/** The stored record, defensively: anything malformed is ignored. */
export function readPauses(raw: unknown): Pause[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is Pause =>
      !!p &&
      typeof p.at === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.at) &&
      Number.isInteger(p.days) &&
      p.days > 0,
  );
}

/** The days every pause adds up to: how far back the week's rows can reach. */
export function pausedDays(pauses: Pause[]): number {
  return pauses.reduce((n, p) => n + p.days, 0);
}

/** A date as the block's stopped calendar has it. */
export function blockDate(date: string, pauses: Pause[]): string {
  const shift = pauses.reduce((n, p) => (date <= p.at ? n + p.days : n), 0);
  return shift ? format(addDays(parseISO(date), shift), "yyyy-MM-dd") : date;
}

/** How many of `rows` (workouts or skips) count toward the week from `weekStart`. */
export function countInWeek(
  rows: { date: string; created_at: string }[],
  week: { weekStart: string; pauses: Pause[]; restartedAt: string | null },
): number {
  const end = format(addDays(parseISO(week.weekStart), 7), "yyyy-MM-dd");
  const since = week.restartedAt ? Date.parse(week.restartedAt) : null;
  return rows.filter((r) => {
    if (since !== null && Date.parse(r.created_at) < since) return false;
    const d = blockDate(r.date, week.pauses);
    return d >= week.weekStart && d < end;
  }).length;
}
