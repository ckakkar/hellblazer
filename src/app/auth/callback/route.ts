import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (PKCE) redirect target. Exchanges the `code` for a session, then
 * forwards the user on to the app. Configured as the Google provider redirect
 * URL in Supabase Auth settings.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  // Connecting Google to an existing account from Settings: a refusal (say,
  // that Google account already has its own Fatty account) comes back here
  // as an error code instead of a code to exchange. Show it on Settings.
  const errorCode = searchParams.get("error_code");
  if (!code && errorCode && safeNext.startsWith("/settings")) {
    return NextResponse.redirect(`${origin}/settings?link_error=${encodeURIComponent(errorCode)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Send a first-time lifter straight into the welcome flow. The (app)
      // layout enforces this too; doing it here just avoids a bounce through
      // /dashboard on the very first sign-in.
      const { data: profile } = await supabase
        .from("profile")
        .select("onboarded_at")
        .maybeSingle();
      if (!profile?.onboarded_at) {
        return NextResponse.redirect(`${origin}/welcome`);
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/?error=auth`);
}
