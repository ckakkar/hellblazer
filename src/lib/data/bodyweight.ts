import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type BodyweightLog =
  Database["public"]["Tables"]["bodyweight_log"]["Row"];

export async function getBodyweightLog(limit = 60): Promise<BodyweightLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bodyweight_log")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
