"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { hashWatchToken, newWatchToken } from "@/lib/watch/token";

/** Tokens kept per lifter and kind; a reinstall mints a new one and strands the old. */
const KEEP = 3;

/**
 * A new device token for the signed-in lifter; the raw token is never stored
 * server-side. Two kinds, from the iPhone app's DeviceSync:
 *   watch  handed to the paired Apple Watch, which uses it for /api/watch
 *   phone  kept by the iPhone itself, so a silent push can have it fetch a
 *          fresh widget snapshot from /api/device/snapshot
 */
async function mint(kind: "watch" | "phone"): Promise<{ token: string; userId: string }> {
  const { supabase, user } = await getAuthedContext();
  const token = newWatchToken();
  const { error } = await supabase
    .from("watch_link")
    .insert({ user_id: user.id, token_hash: hashWatchToken(token), kind });
  if (error) throw error;

  const { data: links } = await supabase
    .from("watch_link")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  const stale = (links ?? []).slice(KEEP).map((link) => link.id);
  if (stale.length > 0) await supabase.from("watch_link").delete().in("id", stale);
  revalidatePath("/settings");
  return { token, userId: user.id };
}

export async function linkWatch() {
  return mint("watch");
}

export async function linkPhone() {
  return mint("phone");
}

/** Revokes one token (a watch's or a phone's): it stops working at once. */
export async function unlinkWatch(input: { token: string }) {
  const { token } = z.object({ token: z.string().min(32).max(128) }).parse(input);
  const { supabase } = await getAuthedContext();
  await supabase.from("watch_link").delete().eq("token_hash", hashWatchToken(token));
}
