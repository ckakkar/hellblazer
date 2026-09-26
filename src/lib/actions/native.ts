"use server";

import { getAuthedContext } from "@/lib/auth";
import { getTimeZone, getUnit } from "@/lib/settings";
import { buildWidgetSnapshot } from "@/lib/widget-snapshot";
import type { WidgetSnapshot } from "@/lib/native-plugins";

/**
 * The iPhone app's widget, Siri and Spotlight snapshot for the signed-in
 * lifter (see buildWidgetSnapshot). The app writes it into its App Group.
 */
export async function getNativeSnapshot(): Promise<Omit<WidgetSnapshot, "updatedAt">> {
  const { supabase, user } = await getAuthedContext();
  const [unit, timeZone] = await Promise.all([getUnit(), getTimeZone()]);
  return buildWidgetSnapshot(supabase, { userId: user.id, unit, timeZone });
}
