import { createBrowserClient } from "@supabase/ssr";
import { createClient as createFixedClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client. Only ever uses NEXT_PUBLIC_* keys, so nothing
 * secret is shipped to the client. Instantiate per-use inside client components.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * A client whose requests all carry this one access token, whoever the
 * browser's session says is signed in by the time they go: a write that
 * must land as one account (a lift note kept for it) can't go as another.
 * No auth methods (the token is fixed); used for a request or two, then let go.
 */
export function createClientAs(accessToken: string) {
  return createFixedClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => accessToken },
  );
}
