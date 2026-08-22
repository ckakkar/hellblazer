"use client";

import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/reactbits/count-up";
import { SpotlightCard } from "@/components/reactbits/spotlight-card";
import type { LeaderboardEntry } from "@/lib/data/leaderboard";
import { kgToLb, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * Split a tonnage into an animatable number and a static suffix, so CountUp
 * springs the digits while "k kg" stays put. Mirrors `formatVolume`'s
 * thresholds exactly, just without pre-joining the string.
 */
function splitVolume(volumeKg: number, unit: Unit) {
  const converted = unit === "lb" ? kgToLb(volumeKg) : volumeKg;
  if (converted >= 1000) {
    return { value: Math.round(converted / 100) / 10, suffix: `k ${unit}` };
  }
  return { value: Math.round(converted), suffix: ` ${unit}` };
}

function Tonnage({
  volumeKg,
  unit,
  className,
  delay = 0,
}: {
  volumeKg: number;
  unit: Unit;
  className?: string;
  delay?: number;
}) {
  const { value, suffix } = splitVolume(volumeKg, unit);
  return (
    <span className={cn("tabular-nums", className)}>
      <CountUp to={value} duration={1.4} delay={delay} separator="," />
      <span className="text-muted/70">{suffix}</span>
    </span>
  );
}

/**
 * The fighter line under a ring name. The epithet is flavour, the tier name is
 * the information: on a phone the compact rows don't have the width for both
 * next to a tonnage, so the epithet drops out there rather than the whole line
 * ending in an ellipsis.
 */
function FighterLine({ entry }: { entry: LeaderboardEntry }) {
  if (!entry.name) return <>Unranked fighter</>;
  return (
    <>
      {entry.name}
      <span className="hidden sm:inline"> · {entry.epithet}</span>
    </>
  );
}

export function Standings({
  entries,
  me,
  unit,
}: {
  entries: LeaderboardEntry[];
  /** Lower-cased username of the signed-in lifter, when they've claimed one. */
  me: string | null;
  unit: Unit;
}) {
  const isMe = (e: LeaderboardEntry) =>
    me != null && e.username.toLowerCase() === me;

  const champion = entries[0];
  const runnersUp = entries.slice(1, 3);
  const rest = entries.slice(3);

  return (
    <div>
      {/* ── Champion ───────────────────────────────────────────────────── */}
      <div
        className="hb-reveal relative mb-3"
        style={{ animationDelay: "40ms" }}
      >
        {/* The aura sits on a wrapper so the sweeping arc isn't clipped by the
            card's own overflow-hidden spotlight layer. */}
        <div className="hb-champion relative rounded-xl">
          <SpotlightCard
            className="rounded-xl border border-accent/25 bg-surface shadow-card"
            spotlightOpacity={0.13}
          >
            {/* Wraps on phones: the tonnage drops to its own row rather than
                stealing width from the ring name, which is the one thing on
                this card that must never be clipped. */}
            <div className="relative flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap sm:gap-5 sm:p-6">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-accent shadow-glow sm:size-16">
                <Crown className="size-7 sm:size-8" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent/80">
                  Strongest in the ring
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "min-w-0 truncate font-impact uppercase leading-none tracking-tight",
                      // Ring names run to 24 characters. Long ones step down a
                      // size so they still land whole; short ones keep the
                      // full swagger.
                      champion.username.length > 15
                        ? "text-xl sm:text-2xl"
                        : "text-2xl sm:text-3xl",
                      // The wordmark sheen, reserved for the top of the ladder.
                      "hb-shiny",
                    )}
                  >
                    {champion.username}
                  </span>
                  {isMe(champion) && (
                    <Badge variant="accent">You</Badge>
                  )}
                </div>
                {/* Wraps rather than truncates: this is the hero card, and a
                    second line costs less than an ellipsis eating the epithet
                    on the narrowest phones. */}
                <div className="mt-1 font-mono text-xs text-muted">
                  {champion.name
                    ? `${champion.name} · ${champion.epithet}`
                    : "Unranked fighter"}
                </div>
              </div>

              {/* Phone: a labelled row under a hairline. Desktop: the stacked
                  right-hand readout it has always been. */}
              <div className="flex w-full items-baseline justify-between gap-3 border-t border-border/70 pt-3.5 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:gap-0.5 sm:border-0 sm:pt-0">
                <span className="order-1 font-mono text-[10px] uppercase tracking-wide text-muted/70 sm:order-2">
                  total moved
                </span>
                <span className="order-2 font-mono text-xl font-semibold text-text sm:order-1 sm:text-2xl">
                  <Tonnage volumeKg={champion.totalVolumeKg} unit={unit} />
                </span>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* ── Runners-up ─────────────────────────────────────────────────── */}
      {runnersUp.length > 0 && (
        <div
          className={cn(
            "mb-3 grid gap-3",
            runnersUp.length === 2 ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {runnersUp.map((e, i) => (
            <div
              key={e.username}
              className="hb-reveal"
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <SpotlightCard
                className={cn(
                  "h-full rounded-xl border bg-surface shadow-card",
                  isMe(e) ? "border-accent/50" : "border-border",
                )}
              >
                <div className="relative flex items-center gap-3.5 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-impact text-base leading-none text-text">
                    {i + 2}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-text">
                        {e.username}
                      </span>
                      {isMe(e) && (
                        <Badge variant="accent">You</Badge>
                      )}
                    </div>
                    <div className="truncate font-mono text-xs text-muted">
                      <FighterLine entry={e} />
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-sm font-semibold text-text">
                    <Tonnage
                      volumeKg={e.totalVolumeKg}
                      unit={unit}
                      delay={0.1 + i * 0.05}
                    />
                  </div>
                </div>
              </SpotlightCard>
            </div>
          ))}
        </div>
      )}

      {/* ── The rest of the ladder ─────────────────────────────────────── */}
      {rest.length > 0 && (
        <>
          {/* Below the podium a leaderboard is a standings table, so it's set
              as one. Forty bordered cards, each with its own entrance delay,
              made the tail of the ladder harder to read than the top of it. */}
          <div className="flex items-baseline justify-between gap-2 border-b border-text/85 px-1 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              The rest of the ladder
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Total moved
            </span>
          </div>
          <ol>
            {rest.map((e, i) => {
              const place = i + 4;
              return (
                <li
                  key={`${e.username}-${place}`}
                  className={cn(
                    "flex items-baseline gap-3 border-b border-border px-1 py-2.5 transition-colors",
                    isMe(e) ? "bg-accent/[0.06]" : "hover:bg-surface/60",
                  )}
                >
                  <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-muted">
                    {place}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="min-w-0 truncate font-display text-[15px] uppercase tracking-wide text-text">
                      {e.username}
                    </span>
                    {isMe(e) && <Badge variant="accent">You</Badge>}
                  </span>
                  <span className="hidden min-w-0 max-w-[38%] truncate font-mono text-[11px] text-muted sm:block">
                    <FighterLine entry={e} />
                  </span>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums text-text">
                    <Tonnage volumeKg={e.totalVolumeKg} unit={unit} />
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
