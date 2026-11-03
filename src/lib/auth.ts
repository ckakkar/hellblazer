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

/** Who's signed in, as the page shell needs them: from the session's verified token. */
export type SessionUser = {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
};

/**
 * Fast identity read for the app layout: the session token's claims,
 * verified against the project's cached public key (ES256), with no round
 * trip to the Auth server. The proxy has already verified (and if need be
 * refreshed) the same token for this request, and RLS checks it again on
 * every query. Not getSession(): its user isn't verified, and Supabase
 * warns in the server log on every request that reads it. Use for display
 * and identity, not as a gate on its own.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    user_metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
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

/** How recent a sign-in has to be to delete the account. */
export const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

/**
 * Whether the lifter signed in with Google or Apple within `ms`: the person
 * who owns the account just now, not only a session left open on a device.
 * From the verified token's sign-in record (`amr`), which refreshing the
 * session doesn't move.
 */
export async function signedInWithin(ms: number): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims as { amr?: { timestamp?: number }[] } | undefined)?.amr ?? [];
  const latest = Math.max(0, ...amr.map((a) => a.timestamp ?? 0));
  return Date.now() - latest * 1000 < ms;
}
