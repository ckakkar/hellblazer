import { cookies, headers } from "next/headers";
import type { Unit } from "@/lib/units";
import { DEFAULT_ACCENT, isAccentKey, type AccentKey } from "@/lib/accents";
import { appearanceIsLocked } from "@/lib/surface";
import {
  TZ_COOKIE_NAME,
  dateInTimeZone,
  isValidTimeZone,
} from "@/lib/local-date";

const UNIT_COOKIE = "wt_unit";
const ACCENT_COOKIE = "hb_accent";
const APPEARANCE_COOKIE = "hb_theme";

/** Night (dark), paper (light), or whichever the device is set to. */
export type Appearance = "system" | "light" | "dark";
export const APPEARANCES: readonly Appearance[] = ["system", "light", "dark"];

/**
 * Reads the light/dark preference from a cookie; the system's by default.
 * An app build that can't follow it is always dark (surface.ts).
 */
export async function getAppearance(): Promise<Appearance> {
  if (await appearanceIsLocked()) return "dark";
  const v = (await cookies()).get(APPEARANCE_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "system";
}

/** Reads the user's display-unit preference from a cookie (canonical is kg). */
export async function getUnit(): Promise<Unit> {
  const store = await cookies();
  return store.get(UNIT_COOKIE)?.value === "lb" ? "lb" : "kg";
}

/** Reads the user's accent-theme preference from a cookie. */
export async function getAccent(): Promise<AccentKey> {
  const store = await cookies();
  const v = store.get(ACCENT_COOKIE)?.value;
  return isAccentKey(v) ? v : DEFAULT_ACCENT;
}

/**
 * The lifter's IANA timezone: the browser's own (cookie), else Vercel's
 * IP-geolocated guess, else UTC. Sessions are dated in the lifter's calendar,
 * so every server-side "today" and "this week" has to use it too, or the
 * early hours east of UTC land on yesterday.
 */
export async function getTimeZone(): Promise<string> {
  const fromCookie = (await cookies()).get(TZ_COOKIE_NAME)?.value;
  if (fromCookie && isValidTimeZone(fromCookie)) return fromCookie;
  const fromIp = (await headers()).get("x-vercel-ip-timezone");
  if (fromIp && isValidTimeZone(fromIp)) return fromIp;
  return "UTC";
}

/** Today's date (`YYYY-MM-DD`) in the lifter's timezone. */
export async function getToday(): Promise<string> {
  return dateInTimeZone(new Date(), await getTimeZone());
}

export const UNIT_COOKIE_NAME = UNIT_COOKIE;
export const ACCENT_COOKIE_NAME = ACCENT_COOKIE;
export const APPEARANCE_COOKIE_NAME = APPEARANCE_COOKIE;
