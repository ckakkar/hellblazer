import { format } from "date-fns";

/**
 * Today's date in the *browser's* local timezone as `YYYY-MM-DD`.
 *
 * Session dates must reflect the day the lifter actually trained. Relying on
 * Postgres `current_date` stamps them in UTC, so a late-night workout in a
 * positive-offset timezone (e.g. training past midnight IST) lands on the
 * previous calendar day: two different training days can collapse onto one.
 * Capturing the date client-side keeps it aligned with the user's real day.
 */
export function todayLocalISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}
