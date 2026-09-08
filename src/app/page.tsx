import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LandingArenaHero } from "@/components/tier/landing-arena-hero";
import { LandingFighterRoster } from "@/components/tier/landing-fighter-roster";
import { CloudOff, Flame, ShieldCheck } from "lucide-react";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="hb-arena hb-ink-noise relative flex min-h-dvh flex-col overflow-hidden">
      <div className="relative mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-text/[0.07] py-5 sm:py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-accent/40 bg-accent/[0.06] text-accent shadow-card">
              <Flame className="size-4" />
            </span>
            <span className="hb-shiny font-display text-[15px] font-semibold uppercase tracking-[0.16em]">
              Hell&nbsp;Blazer
            </span>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-text/[0.07] bg-surface/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted backdrop-blur-sm">
              <CloudOff className="size-3 text-accent" /> Offline ready
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-text/[0.07] bg-surface/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted backdrop-blur-sm">
              <ShieldCheck className="size-3 text-accent" /> Private
            </span>
          </div>
        </header>

        <div>
          <LandingArenaHero error={error} />
          <LandingFighterRoster />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border py-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted">
            <span>Program blocks</span>
            <span className="text-border">·</span>
            <span>Copy-forward logging</span>
            <span className="text-border">·</span>
            <span>Est. 1RM &amp; tonnage</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wide text-muted">
            App by{" "}
            <a
              href="https://kkrwhofrags.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text underline underline-offset-4 transition-colors hover:text-accent"
            >
              Cyrus
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
