import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * A token minted a moment ago can reach the database before the database's
 * clock has caught up with the auth server's ("JWT issued at future",
 * PGRST303), and a second later it's valid. Rare, but it put Home and
 * Profile on the error screen right after a session refresh, so that one
 * answer is tried again after a second.
 */
async function fetchPastClockSkew(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;
  const body = await res.clone().text().catch(() => "");
  if (!body.includes("PGRST303")) return res;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return fetch(input, init);
}

/**
 * Server Supabase client for Server Components, Route Handlers and Server
 * Actions. `cookies()` is async in Next 16, so this factory is async too.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchPastClockSkew },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component where cookies are
            // read-only. Safe to ignore: the proxy refreshes the session.
          }
        },
      },
    },
  );
}
