import Link from "next/link";
import { MAX_RANK, TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { FighterArt } from "@/components/tier/fighter-art";

/* ── Your rank ─────────────────────────────────────────────────────────────
   The dashboard opens on who you are on the ladder: the fighter's portrait,
   their name in the expanded cut, and ten thin steps with the ones you have
   earned filled in. It is the one bold thing on the screen; everything below
   it is quiet. */
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
      className={cn("relative isolate overflow-hidden rounded-3xl bg-surface", className)}
      style={{ ["--hb-fade" as string]: "var(--color-surface)" }}
    >
      <FighterArt
        fighterKey={tier?.key ?? "ohma"}
        variant="hero"
        priority
        className="absolute inset-y-0 right-0 w-[64%] sm:w-[48%]"
        imageClassName="object-[center_18%]"
      />
      <div className="relative flex min-h-[16rem] flex-col justify-between p-5 sm:min-h-[18rem] sm:p-7">
        <div>
          <p className="text-[13px] font-medium text-muted">
            {tier ? `Rank ${rank} of ${MAX_RANK}` : "Unranked"}
          </p>
          <h1
            className={cn(
              "font-display mt-1.5 max-w-[9ch] text-[clamp(2.125rem,9.6vw,2.625rem)] leading-[0.98] sm:text-[3.5rem]",
              tier ? "text-text" : "text-text/70",
            )}
          >
            {tier ? tier.name : "No rank yet"}
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {tier ? tier.epithet : "Log a workout, then ask the judge."}
          </p>
        </div>

        <div className="mt-8 max-w-[62%] sm:max-w-[50%]">
          <div className="flex gap-1" aria-label={`Rank ${rank} of ${MAX_RANK}`}>
            {TIERS.map((t) => (
              <span
                key={t.key}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  t.rank <= rank ? "bg-accent" : "bg-white/[0.12]",
                )}
              />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-muted">
              {next ? `Next, ${next.name.split(" ")[0]}` : "Top of the ladder"}
            </span>
            <Link
              href="/settings"
              className="shrink-0 font-medium text-text transition-opacity hover:opacity-70"
            >
              {tier ? "Get judged" : "Get ranked"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
