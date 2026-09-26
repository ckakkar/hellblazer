import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { apnsConfigured, sendApnsBackground } from "@/lib/apns";

/**
 * The lifter's iPhones, for a widget refresh. Read up front (inside the
 * request), so the push itself can go out after the response.
 */
export async function widgetDevices(db: SupabaseClient<Database>, userId: string): Promise<string[]> {
  if (!apnsConfigured()) return [];
  const { data } = await db.from("apns_device").select("token").eq("user_id", userId);
  return (data ?? []).map((d) => d.token);
}

/**
 * Tells those iPhones their widgets are out of date: a silent push, on which
 * the app fetches a fresh snapshot from /api/device/snapshot
 * (ios/App/App/WidgetRefresher.swift). Sent when a workout is finished, from
 * the website, the app or the watch. Never throws.
 */
export async function refreshWidgets(tokens: string[]) {
  await Promise.all(tokens.map((token) => sendApnsBackground(token, { fatty: "widgets" }).catch(() => null)));
}
