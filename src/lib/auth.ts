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

/** Page/layout guard: redirect to the landing page when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
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
