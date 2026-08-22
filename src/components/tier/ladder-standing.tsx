import Link from "next/link";
import { ChevronUp, ChevronDown, Crown, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIERS, getTier, MAX_RANK } from "@/lib/tiers";

const byRank = (r: number) => TIERS.find((t) => t.rank === r) ?? null;

/**
 * "Where you stand": the full strength ladder with the lifter's rung marked,
 * and the fighters directly above (to chase) and below (already surpassed)
 * called out. Pure server markup; driven by the accepted profile tier.
 */
export function LadderStanding({ tierKey }: { tierKey: string | null }) {
  const current = getTier(tierKey);
  const rank = current?.rank ?? 0;
  const above = current ? byRank(rank + 1) : null; // next to overtake
  const below = current ? byRank(rank - 1) : null; // just surpassed
  const atSummit = rank === MAX_RANK;

  // Ladder renders strongest → weakest, like the login screen.
  const ladder = [...TIERS].sort((a, b) => b.rank - a.rank);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="relative border-b border-border p-5">
        {/* faint kanji watermark, same language as the rank hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-6 select-none font-display text-[7rem] font-bold leading-none text-white/[0.03]"
        >
          位
        </div>

        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          <Swords className="size-3.5 text-accent" />
          Your standing
        </div>

        {current ? (
          <>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="font-impact text-4xl uppercase leading-none text-accent sm:text-5xl">
                  {current.name}
                </div>
                <div className="mt-1.5 font-display text-sm font-semibold uppercase tracking-[0.12em] text-accent/80">
                  {current.epithet}
                </div>
                <div className="mt-1.5 font-mono text-xs text-muted">
                  Rank {rank} / {MAX_RANK} · {current.blurb}
                </div>
              </div>
              <span className="shrink-0 rounded-md border border-accent/40 bg-accent/[0.07] px-2.5 py-1 font-mono text-xs tabular-nums text-accent">
                #{rank}
              </span>
            </div>

            {/* above / below callout */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Neighbor
                dir="up"
                label={atSummit ? "At the summit" : "Chasing"}
                name={above?.name ?? "No one left above"}
                epithet={above?.epithet ?? null}
                rank={above?.rank ?? null}
                emphasis
              />
              <Neighbor
                dir="down"
                label={below ? "Ahead of" : "The climb begins"}
                name={below?.name ?? "You're on the first rung"}
                epithet={below?.epithet ?? null}
                rank={below?.rank ?? null}
              />
            </div>
          </>
        ) : (
          <div className="mt-2">
            <div className="font-impact text-4xl uppercase leading-none text-muted sm:text-5xl">
              Unranked
            </div>
            <p className="mt-2 max-w-md text-sm text-muted">
              You haven&apos;t claimed a rung yet. Run a strength evaluation to
              find your place among the fighters.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/[0.07] px-3.5 py-2 text-sm font-medium text-accent shadow-glow transition-colors hover:bg-accent/[0.12]"
            >
              <Swords className="size-4" />
              Get evaluated
            </Link>
          </div>
        )}
      </div>

      {/* the ladder itself */}
      <ol className="p-2 sm:p-3">
        {ladder.map((t) => {
          const isYou = current !== null && t.rank === rank;
          const conquered = rank > 0 && t.rank < rank;
          const isNext = current !== null && t.rank === rank + 1;
          const isTop = t.rank === MAX_RANK;
          return (
            <li key={t.key}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                  isYou && "bg-accent/[0.08] shadow-glow",
                )}
              >
                {/* rail node */}
                <span className="flex w-4 shrink-0 justify-center">
                  <span
                    className={cn(
                      "size-2.5 rounded-full ring-2 ring-bg",
                      isYou
                        ? "bg-accent"
                        : conquered
                          ? "bg-accent-dim"
                          : "bg-surface-2",
                    )}
                  />
                </span>

                <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted/70">
                  {String(t.rank).padStart(2, "0")}
                </span>

                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-impact uppercase leading-none tracking-tight",
                    isYou
                      ? "text-lg text-accent"
                      : conquered
                        ? "text-sm text-text"
                        : "text-sm text-muted/45",
                  )}
                >
                  {t.name}
                </span>

                <span
                  className={cn(
                    "hidden shrink-0 font-mono text-[10px] uppercase tracking-wide sm:inline",
                    isYou ? "text-accent/70" : "text-muted/40",
                  )}
                >
                  {t.epithet}
                </span>

                {isTop && !isYou && (
                  <Crown className="size-3.5 shrink-0 text-muted/50" />
                )}
                {isYou && <Chip tone="you">You</Chip>}
                {isNext && <Chip tone="next">Next</Chip>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Neighbor({
  dir,
  label,
  name,
  epithet,
  rank,
  emphasis,
}: {
  dir: "up" | "down";
  label: string;
  name: string;
  epithet: string | null;
  rank: number | null;
  emphasis?: boolean;
}) {
  const Icon = dir === "up" ? ChevronUp : ChevronDown;
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        emphasis ? "border-accent/25 bg-accent/[0.04]" : "border-border",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em]",
          emphasis ? "text-accent" : "text-muted",
        )}
      >
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="min-w-0 truncate font-display text-sm font-semibold text-text">
          {name}
        </span>
        {rank !== null && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
            #{rank}
          </span>
        )}
      </div>
      {epithet && (
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-muted/60">
          {epithet}
        </div>
      )}
    </div>
  );
}

function Chip({ tone, children }: { tone: "you" | "next"; children: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider",
        tone === "you"
          ? "bg-accent text-bg"
          : "border border-accent/40 text-accent",
      )}
    >
      {children}
    </span>
  );
}
