import Link from "next/link";
import { formatFighterNumber, TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { FighterArt } from "@/components/tier/fighter-art";

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
    <section
      className={cn(
        "hb-ink-noise relative isolate min-h-64 overflow-hidden border-y-2 border-text/80",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-border" />
      <FighterArt
        fighterKey={tier?.key ?? "ohma"}
        className="absolute inset-y-0 right-[-12%] w-[72%] opacity-75 sm:right-[-4%] sm:w-[58%]"
        imageClassName="scale-[1.04] object-[center_20%]"
      />
      <div className="relative z-10 flex min-h-64 max-w-[72%] flex-col justify-between py-5 sm:max-w-[58%] sm:py-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            <span className="h-px w-8 bg-accent" />
            Your corner
          </div>
          <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-text/60">
            {tier ? `Official rank · ${formatFighterNumber(rank)}` : "Status · unranked"}
          </div>
          <h1
            className={cn(
              "mt-1 font-impact text-[3.35rem] uppercase leading-[0.78] tracking-[-0.025em] sm:text-7xl",
              tier ? "text-text" : "text-text/70",
            )}
          >
            {tier ? tier.name : "No name on the bill"}
          </h1>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            {tier ? tier.epithet : "Log the work. Demand a verdict."}
          </p>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Link
              href="/settings"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-text/60 underline-offset-4 transition-colors hover:text-accent hover:underline"
            >
              {tier ? "Demand a new verdict" : "Get weighed in"}
            </Link>
            {next && (
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text/55">
                Target · <span className="text-text">{next.name.split(" ")[0]}</span>
              </span>
            )}
          </div>
          <div className="flex gap-[3px]">
            {TIERS.map((t) => (
              <span
                key={t.key}
                className={cn(
                  "h-1.5 flex-1 skew-x-[-12deg]",
                  t.rank <= rank ? "bg-accent" : "bg-text/15",
                )}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
    </section>
  );
}
