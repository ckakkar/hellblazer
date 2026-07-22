import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { ShinyText, Reveal } from "@/components/ui/motion";
import { Flame } from "lucide-react";

export default async function Landing() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* single restrained ember glow — the only color on an otherwise mono page */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-52 left-1/2 h-[560px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-[130px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,90,38,0.16), transparent)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <header className="flex items-center gap-2 py-7">
          <span className="flex size-6 items-center justify-center rounded-md border border-accent/40 text-accent">
            <Flame className="size-3.5" />
          </span>
          <span className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-text">
            Hell&nbsp;Blazer
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center pb-24 pt-8">
          <Reveal>
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-muted">
              Training log
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-tight text-text sm:text-7xl">
              Your training,
              <br />
              <ShinyText>measured to the set.</ShinyText>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mt-7 max-w-lg text-base leading-7 text-muted sm:text-lg">
              A precision tracker built around a fast mid-workout logger and a
              live analytics engine. Log the set — watch the numbers move.
            </p>
          </Reveal>

          <Reveal delay={280}>
            <div className="mt-10">
              <GoogleSignIn />
              <p className="mt-3 text-xs text-muted">
                Google sign-in only. Your data is yours — isolated per account.
              </p>
            </div>
          </Reveal>

          <Reveal delay={380}>
            <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <span>Template-driven</span>
              <span className="text-border">/</span>
              <span>Copy-forward logging</span>
              <span className="text-border">/</span>
              <span>Est. 1RM &amp; weekly sets-per-muscle</span>
            </div>
          </Reveal>
        </section>

        <footer className="py-6 text-xs text-muted/70">
          Built on Next.js + Supabase · RLS-isolated, multi-user
        </footer>
      </div>
    </main>
  );
}
