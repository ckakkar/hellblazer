import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MAX_RANK, TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { FighterArt } from "@/components/tier/fighter-art";

/* ── Your rank ─────────────────────────────────────────────────────────────
   The dashboard opens on who you are on the ladder, as a fight-poster hero.
   On a phone it runs edge to edge and up under the clear top bar, so the
   fighter fills the top of the screen and bleeds into the black; from `md`
   it is a large card beside the next workout.

   Motion (globals.css, `.hb-hero-*`), all transform/opacity:
   - on arrival the portrait settles in and the rank ladder fills step by
     step, which is the rank being read out;
   - scrolling, the portrait drifts slower than the page and dims.
   Neither loops, and reduced motion shows the finished frame. */
export function FightCardHero({
  tier,
  className,
}: {
  tier: Tier | null | undefined;
  className?: string;
}) {
  const rank = tier?.rank ?? 0;
  const next = TIERS.find((t) => t.rank === rank + 1);
  const [first, ...rest] = (tier?.name ?? "No rank yet").split(" ");

  return (
    <section
      className={cn(
        "hb-hero-bleed relative isolate flex h-[clamp(22rem,57svh,34rem)] flex-col justify-end overflow-hidden rounded-3xl [--hb-fade:var(--color-bg)] md:h-auto md:min-h-[21rem] md:bg-surface md:[--hb-fade:var(--color-surface)]",
        className,
      )}
    >
      {/* The portrait, lit in the lifter's accent from above */}
      <div className="hb-hero-parallax absolute inset-0 -z-10 md:inset-y-0 md:left-auto md:right-0 md:w-[58%]">
        <div className="hb-hero-art absolute inset-0">
          <FighterArt
            fighterKey={tier?.key ?? "ohma"}
            variant="hero"
            priority
            fade="bottom"
            className="absolute inset-0"
            imageClassName="object-[62%_12%] md:object-[center_18%]"
          />
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-screen"
            style={{
              background:
                "radial-gradient(70% 55% at 72% 22%, rgb(var(--accent-rgb) / 0.22), transparent 70%)",
            }}
          />
        </div>
        {/* Keeps the copy legible: black climbs from the bottom and the left */}
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(to top, var(--color-bg) 8%, rgb(0 0 0 / 0.72) 34%, transparent 62%), linear-gradient(to right, rgb(0 0 0 / 0.55), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(to right, var(--color-surface) 0%, var(--color-surface) 6%, transparent 60%), linear-gradient(to top, var(--color-surface) 0%, transparent 35%), linear-gradient(to bottom, var(--color-surface) 0%, transparent 18%)",
          }}
        />
      </div>

      <div className="relative px-5 pb-20 md:px-7 md:pb-7 md:pt-7">
        <p className="hb-hero-rise flex items-center gap-2 text-[13px] font-medium text-text/80">
          {tier ? (
            <>
              <span className="tnum rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-black">
                Rank {rank}
              </span>
              <span className="text-text/75">of {MAX_RANK}</span>
            </>
          ) : (
            <span className="text-muted">Unranked</span>
          )}
        </p>
        <h1
          className={cn(
            "hb-hero-rise hb-hero-name font-display mt-3 text-[clamp(2.75rem,13.5vw,3.75rem)] leading-[0.9] md:max-w-[8ch] md:text-[4rem]",
            tier ? "text-text" : "text-text/70",
          )}
          style={{ animationDelay: "80ms" }}
        >
          {first}
          {rest.length > 0 && (
            <>
              <br />
              {rest.join(" ")}
            </>
          )}
        </h1>
        <p className="hb-hero-rise mt-3 text-[15px] text-text/70" style={{ animationDelay: "140ms" }}>
          {tier ? tier.epithet : "Log a workout, then ask the judge."}
        </p>

        <div className="mt-6 md:max-w-[50%]">
          <div className="flex gap-1" role="img" aria-label={`Rank ${rank} of ${MAX_RANK}`}>
            {TIERS.map((t, i) => (
              <span
                key={t.key}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  t.rank <= rank ? "hb-hero-step bg-accent" : "bg-white/[0.14]",
                )}
                style={t.rank <= rank ? { animationDelay: `${260 + i * 70}ms` } : undefined}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-text/60">
              {next ? `Next, ${next.name.split(" ")[0]}` : "Top of the ladder"}
            </span>
            <Link
              href="/settings"
              className="-mr-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/[0.1] py-1.5 pl-3 pr-2 font-medium text-text backdrop-blur-md transition-colors hover:bg-white/[0.16]"
            >
              {tier ? "Get judged" : "Get ranked"}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
