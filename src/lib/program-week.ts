import { addDays, format, parseISO } from "date-fns";
import { STALE_CLOCK_MS } from "@/lib/workout-clock";

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

export type BlockWeek = { weekStart: string; pauses: Pause[]; restartedAt: string | null };

/** Whether a workout or skip counts toward the week from `weekStart`. */
export function inWeek(row: { date: string; created_at: string }, week: BlockWeek): boolean {
  const end = format(addDays(parseISO(week.weekStart), 7), "yyyy-MM-dd");
  if (week.restartedAt !== null && Date.parse(row.created_at) < Date.parse(week.restartedAt)) return false;
  const d = blockDate(row.date, week.pauses);
  return d >= week.weekStart && d < end;
}

/** How many of `rows` (workouts or skips) count toward the week from `weekStart`. */
export function countInWeek(rows: { date: string; created_at: string }[], week: BlockWeek): number {
  return rows.filter((r) => inWeek(r, week)).length;
}

/** A workout or a skip, and the program day it was (null from before days were recorded). */
export type WeekEntry = { date: string; created_at: string; program_day_id: string | null };

export type DayStatus = "done" | "skipped" | null;

/**
 * The week's days in the program's order: which are done, which skipped,
 * and which is next. A workout counts as the day it was started for, so
 * doing Day 3 first leaves Day 1 next; a skip covers the day it skipped.
 * An entry from before days were recorded fills the first open day, as the
 * rotation counted them then. A day done twice is an extra workout, not
 * the next day. Next is the first open day, or the first day once every
 * one is in (next week's first).
 */
export function weekDays(
  dayIds: string[],
  workouts: WeekEntry[],
  skips: WeekEntry[],
  week: BlockWeek,
): { status: DayStatus[]; extra: number; next: number } {
  const status: DayStatus[] = dayIds.map(() => null);
  const byOrder = (a: WeekEntry, b: WeekEntry) => Date.parse(a.created_at) - Date.parse(b.created_at);
  const entries = [
    ...workouts.filter((w) => inWeek(w, week)).map((e) => ({ e, kind: "done" as const })),
    ...skips.filter((s) => inWeek(s, week)).map((e) => ({ e, kind: "skipped" as const })),
  ].sort((a, b) => byOrder(a.e, b.e));
  let extra = 0;
  const unplaced: typeof entries = [];
  for (const entry of entries) {
    const i = entry.e.program_day_id ? dayIds.indexOf(entry.e.program_day_id) : -1;
    if (i < 0) {
      unplaced.push(entry);
    } else if (status[i] === null || (status[i] === "skipped" && entry.kind === "done")) {
      // Skipped, then done anyway: it's done.
      status[i] = entry.kind;
    } else if (entry.kind === "done") {
      extra++;
    }
  }
  for (const entry of unplaced) {
    const open = status.indexOf(null);
    if (open >= 0) status[open] = entry.kind;
    else if (entry.kind === "done") extra++;
  }
  const open = status.indexOf(null);
  return { status, extra, next: open >= 0 ? open : 0 };
}

/**
 * The workouts that count, as a PostgREST `or` filter on v_session_summary
 * (with `working_sets > 0` beside it): finished, or left open past the
 * stale clock (trained, the finish just missed). An empty or abandoned
 * start never counts.
 */
export function countedWorkouts(now = Date.now()): string {
  return `finished_at.not.is.null,created_at.lt."${new Date(now - STALE_CLOCK_MS).toISOString()}"`;
}
