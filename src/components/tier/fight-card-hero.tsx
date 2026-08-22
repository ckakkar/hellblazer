import Link from "next/link";
import { TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/* ── The card ──────────────────────────────────────────────────────────────
   Who you are on the bill, set as the top of the bill. This used to be a thin
   clickable strip above a grid of equal-weight stat boxes, which left the page
   with no hero at all; a fight card always opens by naming the fighter, so the
   rank name is the largest thing on the screen and everything below it is
   supporting detail.

   Deliberately not wrapped in a Card. It sits straight on the page ground with
   a heavy rule beneath it, which is what stops the dashboard reading as a
   stack of identical bordered rectangles. */
export function FightCardHero({
  tier,
  className,
}: {
  tier: Tier | null | undefined;
  className?: string;
}) {
  const rank = tier?.rank ?? 0;
  const next = TIERS.find((t) => t.rank === rank + 1);

  return (
    <section className={cn("relative", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          {tier ? `Rank ${String(rank).padStart(2, "0")}` : "Unranked"}
        </span>
        <Link
          href="/settings"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          {tier ? "Re-weigh" : "Get weighed in"}
        </Link>
      </div>

      <h1
        className={cn(
          "mt-1.5 font-impact uppercase leading-[0.86] tracking-tight",
          tier ? "text-text" : "text-muted",
          // The longest name on the ladder is "Wakatsuki Takeshi"; the display
          // face is condensed enough to hold it on one line by 400px.
          "text-[2.75rem] sm:text-6xl",
        )}
      >
        {tier ? tier.name : "No rank yet"}
      </h1>

      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
        {tier ? tier.epithet : "Log a few sessions, then ask for a verdict"}
      </p>

      {/* Rungs, then the name of whoever is one rung up. The ladder is the
          only place the climb is legible as a distance rather than a number. */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-[3px]">
          {TIERS.map((t) => (
            <span
              key={t.key}
              className={cn(
                "h-1.5 flex-1",
                t.rank <= rank ? "bg-accent" : "bg-surface-2",
              )}
            />
          ))}
        </div>
        {next && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Next&nbsp;·&nbsp;
            <span className="text-text">{next.name.split(" ")[0]}</span>
          </span>
        )}
      </div>
    </section>
  );
}
