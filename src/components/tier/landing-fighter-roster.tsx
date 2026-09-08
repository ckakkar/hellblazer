"use client";

import { useState } from "react";
import { Crosshair, Quote } from "lucide-react";
import { FighterArt } from "@/components/tier/fighter-art";
import { FIGHTER_DOSSIERS } from "@/lib/fighter-dossiers";
import { TIERS, type TierKey } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const BILL = [...TIERS].sort((a, b) => b.rank - a.rank);

export function LandingFighterRoster() {
  const [activeKey, setActiveKey] = useState<TierKey>("kuroki");
  const fighter = BILL.find((entry) => entry.key === activeKey) ?? BILL[0];
  const dossier = FIGHTER_DOSSIERS[fighter.key];

  return (
    <section
      className="hb-reveal relative z-10 mt-4 border-t-2 border-text/80 pt-px lg:mt-0"
      style={{ animationDelay: "180ms" }}
      aria-labelledby="fighter-roster-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-accent">
            Choose your standard
          </p>
          <h2
            id="fighter-roster-title"
            className="mt-1 font-impact text-3xl uppercase leading-none text-text sm:text-4xl"
          >
            The mountain
          </h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Ten names. No shortcuts.
          </p>
          <p className="mt-1 text-xs text-muted">
            Pick a fighter. Take the corner order.
          </p>
        </div>
      </div>

      <div className="grid border-b border-border lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label="Kengan fighter roster"
          className="grid grid-cols-2 gap-px bg-border/70 sm:grid-cols-5 lg:grid-cols-1 lg:border-r lg:border-border"
        >
          {BILL.map((entry) => {
            const active = entry.key === activeKey;
            return (
              <button
                key={entry.key}
                id={`fighter-${entry.key}-tab`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="active-fighter-dossier"
                onClick={() => setActiveKey(entry.key)}
                className={cn(
                  "group relative flex min-w-0 items-center gap-2.5 bg-bg px-2 py-2 text-left outline-none transition-colors duration-200 focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent sm:flex-col sm:items-start sm:gap-2 sm:p-2.5 lg:flex-row lg:items-center lg:gap-3 lg:px-3 lg:py-2",
                  active
                    ? "bg-surface text-accent"
                    : "text-text hover:bg-surface/70 hover:text-accent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent transition-transform lg:inset-y-0 lg:left-0 lg:h-auto lg:w-0.5 lg:origin-top",
                    active ? "scale-100" : "scale-0 group-hover:scale-100",
                  )}
                />
                <FighterArt
                  fighterKey={entry.key}
                  variant="thumbnail"
                  className="h-11 w-12 shrink-0 border border-border bg-black transition-colors group-hover:border-accent/50 sm:h-14 sm:w-full lg:h-11 lg:w-12"
                  imageClassName="transition duration-300 group-hover:scale-105"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] tabular-nums text-muted">
                      {String(entry.rank).padStart(2, "0")}
                    </span>
                    <span className="font-impact text-[15px] uppercase leading-[0.9] sm:block sm:w-full sm:truncate sm:text-lg sm:leading-none lg:w-auto">
                      {entry.name}
                    </span>
                  </span>
                  <span className="mt-1 hidden truncate font-mono text-[8px] uppercase tracking-[0.12em] text-muted lg:block">
                    {entry.epithet}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <article
          key={fighter.key}
          id="active-fighter-dossier"
          role="tabpanel"
          aria-labelledby={`fighter-${fighter.key}-tab`}
          className="hb-dossier-switch hb-panel-cut relative isolate min-h-[34rem] overflow-hidden bg-surface lg:min-h-[38rem]"
        >
          <FighterArt
            fighterKey={fighter.key}
            variant="card"
            priority
            className="absolute inset-x-0 top-0 -z-10 h-[20rem] bg-black sm:h-[25rem] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[62%]"
            imageClassName="object-[center_18%] lg:object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-surface/75 to-surface lg:bg-gradient-to-r lg:from-surface lg:via-surface/95 lg:to-transparent"
          />
          <span
            aria-hidden
            className="absolute -right-2 -top-8 -z-10 font-impact text-[13rem] leading-none text-text/[0.035] sm:text-[17rem]"
          >
            {String(fighter.rank).padStart(2, "0")}
          </span>

          <div className="relative flex min-h-[34rem] max-w-2xl flex-col justify-end px-5 pb-6 pt-60 sm:px-8 sm:pb-8 sm:pt-80 lg:min-h-[38rem] lg:w-[61%] lg:justify-center lg:px-10 lg:py-12">
            <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              Official rank · {String(fighter.rank).padStart(2, "0")}
            </div>
            <h3 className="mt-4 font-impact text-4xl uppercase leading-[0.86] text-text sm:text-5xl lg:text-6xl">
              {fighter.name}
            </h3>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              {fighter.epithet}
            </p>
            <p className="mt-5 max-w-xl text-sm leading-6 text-text/75 sm:text-base sm:leading-7">
              {dossier.profile}
            </p>

            <dl className="mt-5 grid max-w-xl grid-cols-2 gap-px bg-border">
              <div className="bg-bg/90 px-3 py-3">
                <dt className="font-mono text-[8px] uppercase tracking-[0.18em] text-muted">
                  Discipline
                </dt>
                <dd className="mt-1 text-sm font-medium text-text">
                  {dossier.discipline}
                </dd>
              </div>
              <div className="bg-bg/90 px-3 py-3">
                <dt className="font-mono text-[8px] uppercase tracking-[0.18em] text-muted">
                  Signature
                </dt>
                <dd className="mt-1 text-sm font-medium text-text">
                  {dossier.signature}
                </dd>
              </div>
            </dl>

            <blockquote className="relative mt-4 max-w-xl border-l-2 border-accent bg-bg/80 px-4 py-3 backdrop-blur-sm">
              <Quote className="absolute right-3 top-3 size-4 text-accent/35" />
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-accent">
                <Crosshair className="size-3" /> Corner order
              </div>
              <p className="mt-2 pr-4 text-sm font-medium leading-5 text-text">
                {dossier.cornerOrder}
              </p>
            </blockquote>
          </div>
        </article>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-5">
        <p className="max-w-2xl text-sm leading-6 text-text/70">
          You begin beneath the bill. Every honest session writes your name a
          little higher.
        </p>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          Select · study · train
        </span>
      </div>
    </section>
  );
}
