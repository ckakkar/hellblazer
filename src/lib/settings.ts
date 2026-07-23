import { cookies } from "next/headers";
import type { Unit } from "@/lib/units";
import { DEFAULT_ACCENT, isAccentKey, type AccentKey } from "@/lib/accents";

const UNIT_COOKIE = "wt_unit";
const ACCENT_COOKIE = "hb_accent";

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

export const UNIT_COOKIE_NAME = UNIT_COOKIE;
export const ACCENT_COOKIE_NAME = ACCENT_COOKIE;
