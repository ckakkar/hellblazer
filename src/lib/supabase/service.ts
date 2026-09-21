import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client that BYPASSES RLS and column grants. Server-only:
 * must never be imported into client code. Two users: the reminder cron, which
 * reads subscriptions/schedules across all users, and the strength judge, which
 * is the only writer of rank columns (a lifter's own token can't touch them).
 * Every judge query must scope itself with `.eq("user_id", user.id)`. Returns
 * null when the key isn't configured, so callers can degrade gracefully.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
