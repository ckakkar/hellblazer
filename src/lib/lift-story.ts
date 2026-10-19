import { differenceInCalendarDays, parseISO, subWeeks } from "date-fns";

/**
 * What a lift's sessions say, as one sentence's worth of numbers: how far
 * its estimated max moved over the recent block, and where its record sits.
 * The Progress page leads with this rather than a grid of figures.
 */
export type LiftStory = {
  /** Change over the block, kg (latest session against the block's first). */
  change: number;
  from: number;
  to: number;
  /** Whole weeks between the two, at least 1. */
  weeks: number;
  /** Sessions in the block. */
  sessions: number;
  /** The best estimated max ever, and the session it came in. */
  record: { value: number; date: string };
};

export function liftStory(
  points: { date: string; est1rm: number }[],
  blockWeeks = 12,
): LiftStory | null {
  const logged = points.filter((p) => p.est1rm > 0);
  if (logged.length === 0) return null;
  const last = logged[logged.length - 1];
  const start = subWeeks(parseISO(last.date), blockWeeks);
  const block = logged.filter((p) => parseISO(p.date) >= start);
  const first = block[0];
  const record = logged.reduce((best, p) => (p.est1rm > best.est1rm ? p : best), logged[0]);
  return {
    change: last.est1rm - first.est1rm,
    from: first.est1rm,
    to: last.est1rm,
    weeks: Math.max(1, Math.round(differenceInCalendarDays(parseISO(last.date), parseISO(first.date)) / 7)),
    sessions: block.length,
    record: { value: record.est1rm, date: record.date },
  };
}
