import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { FighterArt } from "@/components/tier/fighter-art";
import { LandingArenaHero } from "@/components/tier/landing-arena-hero";
import { TIERS } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  // Kuroki (rank 10) on top, Rei (rank 1) at the floor.
  const ladder = [...TIERS].sort((a, b) => b.rank - a.rank);

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
          <section
            className="hb-reveal relative z-10 mt-4 border-t-2 border-text/80 pt-px lg:mt-0"
            style={{ animationDelay: "180ms" }}
            aria-label={`The bill: ${TIERS.length} fighters, main event first down to rank 1`}
          >
            <div className="flex items-baseline justify-between border-y border-border py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text/65">
                The mountain
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                Ten names. No shortcuts.
              </span>
            </div>

            <ol className="grid lg:grid-cols-2 lg:gap-x-10">
              {ladder.map((t, i) => {
                const top = t.rank === TIERS.length;
                return (
                  <li
                    key={t.key}
                    className={cn(
                      "group flex items-center gap-3 border-b border-border py-2 transition-colors hover:border-accent/50",
                      top && "border-b-text/30",
                    )}
                  >
                    <FighterArt
                      fighterKey={t.key}
                      variant="thumbnail"
                      className="h-12 w-14 shrink-0 border border-border bg-black"
                      imageClassName="transition duration-300 group-hover:scale-105"
                    />
                    <span className="hb-roster-number w-8 shrink-0 font-impact text-xl tabular-nums transition-colors group-hover:text-accent">
                      {String(t.rank).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-impact uppercase leading-none",
                        top ? "text-2xl text-accent" : "text-xl text-text",
                      )}
                    >
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] sm:block",
                        top ? "text-accent" : "text-text/50",
                      )}
                    >
                      {i === 0 ? "Main event" : t.epithet}
                    </span>
                  </li>
                );
              })}
            </ol>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-text/70">
              You begin beneath the bill. Every honest session writes your name
              a little higher.
            </p>
          </section>
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
