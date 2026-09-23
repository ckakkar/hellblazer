import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profile"]["Row"];

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profile").select("*").maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Has the lifter finished the welcome flow? A narrow single-column read, since
 * the (app) layout runs this on every navigation. Missing profile row (a
 * brand-new Google sign-in) counts as not onboarded.
 */
/** What the app shell needs on every page: whether first-run setup is done,
 *  and who to show in the menu. One small read. */
export type ShellProfile = {
  onboarded: boolean;
  displayName: string | null;
  ringName: string | null;
  tier: string | null;
};

export async function getShellProfile(): Promise<ShellProfile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("onboarded_at, display_name, username, tier")
    .maybeSingle();
  return {
    onboarded: Boolean(data?.onboarded_at),
    displayName: data?.display_name ?? null,
    ringName: data?.username ?? null,
    tier: data?.tier ?? null,
  };
}
