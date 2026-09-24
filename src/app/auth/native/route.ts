import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(20).max(8192),
  nonce: z.string().min(32).max(128),
  next: z.string().max(512).optional(),
});

/**
 * Sign-in for the iOS app. The native Google (later Apple) SDK hands the app
 * an ID token; this exchanges it for a Supabase session and sets the same
 * auth cookies as /auth/callback, then says where to go next. The website
 * never calls this: it uses the redirect flow in /auth/callback.
 */
export async function POST(request: Request) {
  // Same origin only. Otherwise another site could post its own token and
  // sign a visitor into the wrong account (login CSRF).
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { provider, idToken, nonce, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken, nonce });
  if (error) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  // Same routing as /auth/callback: first-timers go through the welcome flow.
  // The client navigates with this value, so only same-site paths are allowed
  // ("//host" and "/\host" would leave the site).
  const { data: profile } = await supabase.from("profile").select("onboarded_at").maybeSingle();
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
  return NextResponse.json({ redirect: profile?.onboarded_at ? safeNext : "/welcome" });
}
