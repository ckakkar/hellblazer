"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

// Cycling combat call-outs — the "match is loading" flavour.
const PHRASES = [
  "Entering the arena",
  "The judge deliberates",
  "Sizing up the opponent",
  "Reading your stance",
  "Tallying the tonnage",
  "Summoning the ladder",
];

/**
 * The Kengan match-loading screen: a charging aura (breathing flame core with
 * expanding shockwave rings) over radiating speed-lines and halftone, a giant
 * 力 kanji behind it, a power-charge bar, and a cycling combat phrase. Used as
 * every route's loading state.
 */
export function ArenaLoader({ label }: { label?: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (label) return;
    const id = setInterval(() => setIdx((n) => (n + 1) % PHRASES.length), 1300);
    return () => clearInterval(id);
  }, [label]);

  const mask =
    "radial-gradient(circle at 50% 44%, black, transparent 60%)";

  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* radiating speed-lines + halftone, faded from the centre */}
      <div
        aria-hidden
        className="hb-speedlines pointer-events-none absolute inset-0 opacity-40"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      />
      <div
        aria-hidden
        className="hb-halftone pointer-events-none absolute inset-0 opacity-30"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      />
      {/* giant kanji backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 select-none font-impact text-[15rem] leading-none text-white/[0.035] sm:text-[19rem]"
      >
        力
      </div>

      {/* charging core */}
      <div className="relative flex size-28 items-center justify-center">
        <span className="hb-ring absolute inset-0 rounded-full border-2 border-accent/60" />
        <span
          className="hb-ring absolute inset-0 rounded-full border-2 border-accent/40"
          style={{ animationDelay: "0.55s" }}
        />
        <span className="hb-breathe relative flex size-[74px] items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 text-accent shadow-glow">
          <Flame className="size-9" />
        </span>
      </div>

      <div className="relative mt-9 font-impact text-2xl uppercase leading-none tracking-tight text-accent sm:text-3xl">
        {label ?? PHRASES[idx]}
        <span className="text-accent/50">…</span>
      </div>
      <div className="relative mt-3 font-mono text-[11px] uppercase tracking-[0.32em] text-muted">
        Hell Blazer
      </div>
      <div className="hb-charge relative mt-6 h-1 w-52 overflow-hidden rounded-full bg-surface-2" />

      <span className="sr-only">Loading…</span>
    </div>
  );
}
