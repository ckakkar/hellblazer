import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Cookie-less anon Supabase client. With no session it only ever sees rows RLS
 * exposes to anonymous callers (e.g. the seeded exercise library, `user_id is
 * null`). Because it reads no request state, it's safe to use inside
 * `unstable_cache` — unlike the cookie-bound server client.
 */
export function createPublicClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
