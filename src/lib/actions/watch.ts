"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { hashWatchToken, newWatchToken } from "@/lib/watch/token";

/** Linked watches kept per lifter; a reinstall mints a new one and strands the old. */
const KEEP = 3;

/**
 * A new Apple Watch token for the signed-in lifter. Called by the iPhone
 * app's WatchSync, which hands it straight to the paired watch; the raw
 * token is never stored server-side.
 */
export async function linkWatch(): Promise<{ token: string; userId: string }> {
  const { supabase, user } = await getAuthedContext();
  const token = newWatchToken();
  const { error } = await supabase
    .from("watch_link")
    .insert({ user_id: user.id, token_hash: hashWatchToken(token) });
  if (error) throw error;

  const { data: links } = await supabase
    .from("watch_link")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const stale = (links ?? []).slice(KEEP).map((link) => link.id);
  if (stale.length > 0) await supabase.from("watch_link").delete().in("id", stale);
  revalidatePath("/settings");
  return { token, userId: user.id };
}

/** Disconnects every watch: their tokens stop working at once. */
export async function unlinkWatches() {
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("watch_link").delete().eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/settings");
}

/** Revokes one token, e.g. the one on this phone when signing out. */
export async function unlinkWatch(input: { token: string }) {
  const { token } = z.object({ token: z.string().min(32).max(128) }).parse(input);
  const { supabase } = await getAuthedContext();
  await supabase.from("watch_link").delete().eq("token_hash", hashWatchToken(token));
}
