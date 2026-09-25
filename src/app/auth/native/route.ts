import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeAppleCode } from "@/lib/apple";

const Body = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(20).max(8192),
  nonce: z.string().min(32).max(128),
  next: z.string().max(512).optional(),
  /** Add this provider to the signed-in account instead of signing in. */
  link: z.boolean().optional(),
  /** Apple only: the one-time code, traded for a revocable refresh token. */
  authorizationCode: z.string().min(1).max(2048).optional(),
  /** Apple only: the name, which Apple shares on the first sign-in alone. */
  fullName: z.string().trim().min(1).max(120).optional(),
});

/**
 * Keeps Apple's refresh token so account deletion can revoke the app's
 * access, as App Store rules require. Never blocks the sign-in itself.
 */
async function storeAppleToken(userId: string, authorizationCode: string | undefined) {
  if (!authorizationCode) return;
  const refreshToken = await exchangeAppleCode(authorizationCode);
  const svc = createServiceClient();
  if (!refreshToken || !svc) return;
  await svc
    .from("apple_token")
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() });
}

/**
 * The iOS app's Google and Apple sheets hand the app an ID token; this turns
 * it into a Supabase session, setting the same auth cookies as
 * /auth/callback, and says where to go next. With `link`, it instead adds
 * the provider to the account that's already signed in, so either one works
 * from then on. The website never calls this: it uses /auth/callback.
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
  const { provider, idToken, nonce, next, link, authorizationCode, fullName } = parsed.data;
  const supabase = await createClient();

  if (link) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    const { error } = await supabase.auth.linkIdentity({ provider, token: idToken, nonce });
    if (error) {
      return NextResponse.json({ error: error.code ?? "link_failed" }, { status: 409 });
    }
    if (provider === "apple") await storeAppleToken(user.id, authorizationCode);
    return NextResponse.json({ linked: true });
  }

  const { data, error } = await supabase.auth.signInWithIdToken({ provider, token: idToken, nonce });
  if (error || !data.user) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  if (provider === "apple") {
    await storeAppleToken(data.user.id, authorizationCode);
    // Apple's ID token carries no name, so the welcome screen would start
    // blank; keep the one Apple handed over.
    if (fullName && !data.user.user_metadata?.full_name) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
    }
  }

  // Same routing as /auth/callback: first-timers go through the welcome flow.
  // The client navigates with this value, so only same-site paths are allowed
  // ("//host" and "/\host" would leave the site).
  const { data: profile } = await supabase.from("profile").select("onboarded_at").maybeSingle();
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
  return NextResponse.json({ redirect: profile?.onboarded_at ? safeNext : "/welcome" });
}
