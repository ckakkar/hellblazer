import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Refreshes the Supabase auth session on every request and gates protected
 * routes on a verified token. Runs from `src/proxy.ts` (Next 16's replacement
 * for middleware). Every query is still checked again by RLS against the same
 * JWT, and server actions confirm the user with the Auth server.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: this call is what refreshes an expired token, so it must run
  // before anything else and on every request, or sessions drop out.
  //
  // getClaims, not getUser: the project signs tokens with an asymmetric key
  // (ES256), so the JWT's signature and expiry are verified here against the
  // cached public key instead of asking the Auth server on every navigation,
  // a round trip to Tokyo before the page could even start rendering.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || path.startsWith("/auth");

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
