import { cookies } from "next/headers";
import type { Unit } from "@/lib/units";

const UNIT_COOKIE = "wt_unit";

/** Reads the user's display-unit preference from a cookie (canonical is kg). */
export async function getUnit(): Promise<Unit> {
  const store = await cookies();
  return store.get(UNIT_COOKIE)?.value === "lb" ? "lb" : "kg";
}

export const UNIT_COOKIE_NAME = UNIT_COOKIE;
