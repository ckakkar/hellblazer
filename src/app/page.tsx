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
      {/* blood-crimson glow — the one color on an otherwise black page */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-52 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full opacity-60 blur-[130px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,45,58,0.18), transparent)",
        }}
      />
      {/* giant kanji watermark: 最強 — "the strongest" */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-24 select-none font-display text-[22rem] font-bold leading-none text-white/[0.02] sm:text-[30rem]"
      >
        闘
      </div>

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
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted">
              最強 · Strength Log
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-6 max-w-4xl font-impact text-6xl uppercase leading-[0.92] tracking-tight text-text sm:text-8xl">
              Train like the
              <br />
              <ShinyText>strongest creature</ShinyText> alive.
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mt-7 max-w-lg text-base leading-7 text-muted sm:text-lg">
              Log every set like it&apos;s a fight. Program your training,
              run it for weeks, and watch your power climb — rep after brutal rep.
            </p>
          </Reveal>

          <Reveal delay={280}>
            <div className="mt-10">
              <GoogleSignIn />
              <p className="mt-3 text-xs text-muted">
                Google sign-in only. Your war is yours — isolated per account.
              </p>
            </div>
          </Reveal>

          <Reveal delay={380}>
            <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-wide text-muted">
              <span>Programs · run it for weeks</span>
              <span className="text-accent/50">/</span>
              <span>Copy-forward logging</span>
              <span className="text-accent/50">/</span>
              <span>Est. 1RM &amp; power analytics</span>
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
