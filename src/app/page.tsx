import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LandingArenaHero } from "@/components/tier/landing-arena-hero";
import { LandingFighterRoster } from "@/components/tier/landing-fighter-roster";
import { Flame } from "lucide-react";

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
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 sm:px-8">
        <header className="flex items-center gap-2 py-7">
          <span className="flex size-7 items-center justify-center border border-accent/50 text-accent">
            <Flame className="size-3.5" />
          </span>
          <span className="hb-shiny font-display text-sm font-semibold uppercase tracking-[0.22em]">
            Hell&nbsp;Blazer
          </span>
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
