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

/**
 * Cookie carrying the browser's IANA timezone, so server renders can work in
 * the lifter's calendar too. Written by `TimezoneSync`, read by `getTimeZone`.
 */
export const TZ_COOKIE_NAME = "hb_tz";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date (`YYYY-MM-DD`) that an instant falls on in `timeZone`. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
