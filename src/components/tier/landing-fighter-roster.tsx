"use client";

import { useEffect, useRef, useState } from "react";
import { FighterArt } from "@/components/tier/fighter-art";
import { Sheet } from "@/components/ui/sheet";
import { FIGHTER_DOSSIERS } from "@/lib/fighter-dossiers";
import { TIERS, type TierKey } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/** Bottom rung first: the ladder reads as it's climbed. */
const RISING = [...TIERS].sort((a, b) => a.rank - b.rank);

/**
 * The ladder as a staircase: each fighter stands on a step as high as their
 * rank, rank 1 at the foot and the summit at the top, so the page shows the
 * climb instead of telling it. On a phone it's swiped through bottom rung
 * first, climbing as it goes; on a desktop the whole flight is on the wall.
 * The summit's step is the accent's (the rank ladder is one of the few live
 * things). Steps rise into place, lowest first, the first time the stairs
 * come into view. Tapping a fighter opens their dossier.
 */
export function LandingFighterRoster() {
  const [openKey, setOpenKey] = useState<TierKey | null>(null);
  const open = openKey ? (RISING.find((t) => t.key === openKey) ?? null) : null;
  const dossier = open ? FIGHTER_DOSSIERS[open.key] : null;

  // Armed only when the stairs start below the fold, so nothing that's
  // already on screen blinks out; shown once they come into view.
  const stairs = useRef<HTMLOListElement>(null);
  const [phase, setPhase] = useState<"still" | "armed" | "shown">("still");
  useEffect(() => {
    const el = stairs.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    const arm = requestAnimationFrame(() => setPhase("armed"));
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("shown");
          seen.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    seen.observe(el);
    return () => {
      cancelAnimationFrame(arm);
      seen.disconnect();
    };
  }, []);

  return (
    <section aria-labelledby="ladder-title" className="pb-12 pt-6 lg:pb-20">
      <div className="mb-6 flex flex-col gap-1 px-5 sm:px-8 lg:mb-10 lg:flex-row lg:items-baseline lg:justify-between lg:px-14 xl:px-20">
        <h2 id="ladder-title" className="hb-display-lg text-[22px] font-semibold tracking-[-0.02em] text-text lg:text-[2.5rem]">
          The ladder
        </h2>
        <p className="text-[15px] text-text/70">Everyone starts unranked. The judge moves you up.</p>
      </div>

      <ol
        ref={stairs}
        data-phase={phase}
        className="hb-stairs flex snap-x snap-mandatory scroll-px-5 items-end gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:grid lg:grid-cols-10 lg:gap-2.5 lg:overflow-visible lg:px-14 xl:px-20"
      >
        {RISING.map((t) => {
          const summit = t.rank === RISING.length;
          const [first, ...rest] = t.name.split(" ");
          return (
            <li
              key={t.key}
              style={{ "--r": t.rank } as React.CSSProperties}
              className="w-[40%] shrink-0 snap-start sm:w-[26%] lg:w-auto"
            >
              <button
                type="button"
                onClick={() => setOpenKey(t.key)}
                aria-label={`Rank ${t.rank}, ${t.name}, ${t.epithet}. Read their file`}
                className="group block w-full text-left focus-visible:outline-none"
              >
                <span className="hb-stair-fighter hb-plate @container relative isolate block aspect-[3/5] overflow-hidden rounded-t-2xl bg-bg [--hb-fade:var(--color-bg)] group-focus-visible:ring-2 group-focus-visible:ring-text/60">
                  <FighterArt fighterKey={t.key} variant="card" fade="bottom" className="absolute inset-0 -z-10" />
                  <span className="absolute inset-x-2.5 bottom-2.5">
                    <span className="font-display block text-[clamp(0.8125rem,12cqw,1.125rem)] leading-[0.95] text-text">
                      {first}
                      {rest.length > 0 && (
                        <>
                          <br />
                          {rest.join(" ")}
                        </>
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-[1.25] text-text/65">{t.epithet}</span>
                  </span>
                </span>
                {/* The step: as high as the rank, its number cut into the face. */}
                <span
                  className={cn(
                    "hb-stair-step block border-t-2 px-2.5 pt-2",
                    // Lit from the top edge and gone by the floor, a plinth rather than a box.
                    summit
                      ? "border-accent bg-gradient-to-b from-accent/[0.22] to-transparent"
                      : "border-text/70 bg-gradient-to-b from-text/[0.09] to-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "tnum font-display block text-[2.5rem] leading-none lg:text-[clamp(1.75rem,2.6vw,2.75rem)]",
                      summit ? "text-accent" : "text-text/85",
                    )}
                  >
                    {t.rank}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-5 text-[13px] text-muted sm:px-8 lg:hidden">Swipe up the ladder.</p>

      <Sheet open={open !== null} onClose={() => setOpenKey(null)} title={open?.name ?? ""}>
        {open && dossier && (
          <div className="px-5 pb-6">
            <p className="text-[15px] text-muted">
              {open.epithet}, rank {open.rank} of {TIERS.length}
            </p>
            <p className="mt-4 text-[16px] leading-[1.5] text-text">{dossier.profile}</p>
            <dl className="mt-5 divide-y divide-text/[0.06] overflow-hidden rounded-2xl bg-text/[0.05]">
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-[15px] text-muted">Style</dt>
                <dd className="text-right text-[15px] text-text">{dossier.discipline}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-[15px] text-muted">Signature</dt>
                <dd className="text-right text-[15px] text-text">{dossier.signature}</dd>
              </div>
            </dl>
            <h3 className="mt-6 text-[13px] font-medium text-muted">Training note</h3>
            <p className="mt-1.5 text-[15px] leading-[1.5] text-text">{dossier.cornerOrder}</p>
          </div>
        )}
      </Sheet>
    </section>
  );
}
