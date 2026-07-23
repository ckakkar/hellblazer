"use client";

import { useState, useTransition } from "react";
import { Flame, Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPreset } from "@/lib/actions/templates";

type PresetLite = {
  id: string;
  name: string;
  description: string;
  days: number;
  weeks: number;
};

/**
 * First-run onboarding — a new lifter with no history is pushed straight at a
 * ready-to-run split (the 5-day is featured), with the rest one tap away.
 */
export function OnboardingHero({
  featured,
  others,
}: {
  featured: PresetLite;
  others: PresetLite[];
}) {
  const [pending, start] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function load(id: string) {
    setLoadingId(id);
    start(async () => {
      try {
        await loadPreset({ presetId: id });
      } finally {
        setLoadingId(null);
      }
    });
  }

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-accent/25 bg-surface p-6">
      {/* ambient crimson glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.35), transparent)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
          <Flame className="size-3.5" />
          Draw first blood
        </div>
        <h2 className="mt-2 font-impact text-2xl uppercase leading-tight tracking-tight text-text sm:text-3xl">
          Load your first split
        </h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted">
          Start with the featured 5-day split — it drops in as a ready-to-run
          {" "}
          {featured.weeks}-week program you can begin today. Change or swap
          anything later.
        </p>

        <div className="mt-4 rounded-lg border border-border bg-surface-2/50 p-4">
          <div className="flex items-center gap-2">
            <Swords className="size-4 text-accent" />
            <span className="text-sm font-semibold text-text">
              {featured.name}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            {featured.description}
          </p>
          <div className="mt-1 font-mono text-xs text-muted">
            {featured.days} days/week · {featured.weeks} weeks
          </div>
          <Button
            size="lg"
            className="mt-3 w-full"
            disabled={pending}
            onClick={() => load(featured.id)}
          >
            {loadingId === featured.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Flame className="size-4" />
            )}
            {loadingId === featured.id
              ? "Loading…"
              : `Load the ${featured.days}-Day Split`}
          </Button>
        </div>

        {others.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              Prefer something else?
            </div>
            <div className="flex flex-wrap gap-2">
              {others.map((p) => (
                <button
                  key={p.id}
                  disabled={pending}
                  onClick={() => load(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-45"
                >
                  {loadingId === p.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
