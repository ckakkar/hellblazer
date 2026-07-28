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
export async function isOnboarded(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("onboarded_at")
    .maybeSingle();
  return Boolean(data?.onboarded_at);
}
