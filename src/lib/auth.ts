import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/** Returns the authenticated user or null (validated against the auth server). */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Fast identity read from the already-validated session cookie — no auth-server
 * round-trip. Safe for the app layout because the proxy authenticates every
 * request with getUser() (refreshing + gating unauth traffic) and RLS validates
 * the JWT signature on every query. Use for display/identity, not as a gate on
 * its own.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/");
  return user;
}

/** Action guard: supabase client + user, throwing when unauthenticated. */
export async function getAuthedContext(): Promise<{ supabase: DB; user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}
