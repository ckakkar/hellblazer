import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profile"]["Row"];

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profile").select("*").maybeSingle();
  if (error) throw error;
  return data ?? null;
}
