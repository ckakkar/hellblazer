"use client";

import { Crown } from "lucide-react";
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
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full opacity-60 blur-[70px]"
              style={{
                background:
                  "radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.28), transparent)",
              }}
            />
            <div className="relative flex items-center gap-4 p-5 sm:gap-5 sm:p-6">
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
                      "min-w-0 truncate font-impact text-2xl uppercase leading-none tracking-tight sm:text-3xl",
                      // The wordmark sheen, reserved for the top of the ladder.
                      "hb-shiny",
                    )}
                  >
                    {champion.username}
                  </span>
                  {isMe(champion) && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-bg">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted">
                  {champion.name
                    ? `${champion.name} · ${champion.epithet}`
                    : "Unranked fighter"}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-mono text-xl font-semibold text-text sm:text-2xl">
                  <Tonnage volumeKg={champion.totalVolumeKg} unit={unit} />
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted/70">
                  total moved
                </div>
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
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-bg">
                          You
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-xs text-muted">
                      {e.name ? `${e.name} · ${e.epithet}` : "Unranked fighter"}
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
        <ol className="flex flex-col gap-2">
          {rest.map((e, i) => {
            const place = i + 4;
            return (
              <SpotlightCard
                as="li"
                key={`${e.username}-${place}`}
                className={cn(
                  "hb-reveal min-w-0 rounded-xl border bg-surface shadow-card transition-colors",
                  isMe(e)
                    ? "border-accent/50 bg-accent/[0.05]"
                    : "border-border hover:border-accent/30",
                )}
                // Cap the stagger so row 40 doesn't wait a second and a half.
                style={{ animationDelay: `${Math.min(240 + i * 35, 700)}ms` }}
              >
                <div className="relative flex items-center gap-3.5 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2">
                    <span className="font-impact text-base leading-none tabular-nums text-muted/70">
                      {place}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-text">
                        {e.username}
                      </span>
                      {isMe(e) && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-bg">
                          You
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-xs text-muted">
                      {e.name ? `${e.name} · ${e.epithet}` : "Unranked fighter"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold text-text">
                      <Tonnage volumeKg={e.totalVolumeKg} unit={unit} />
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted/70">
                      total moved
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </ol>
      )}
    </div>
  );
}
