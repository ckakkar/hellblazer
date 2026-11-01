"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SectionLabel } from "@/components/ui/page-header";
import { FighterArt } from "@/components/tier/fighter-art";
import { MuscleSetBars } from "@/components/charts/muscle-set-bars";
import { loadPreset } from "@/lib/actions/templates";
import type { Preset } from "@/lib/presets";
import type { PresetBreakdown } from "@/lib/preset-stats";
import { useAction } from "@/lib/use-action";

/**
 * Starter programs: a row you swipe through on a phone, a grid from `sm` up.
 * A card opens the program to look through (its week in two charts, then
 * every day's exercises) without loading anything; "Use this program", on
 * the card or in the preview, creates its templates and makes it active.
 */
export function PresetCarousel({
  presets,
  breakdowns,
  title = "Starter programs",
}: {
  presets: Preset[];
  /** Each program's week, by id (getPresetBreakdowns), for the preview's charts. */
  breakdowns?: Record<string, PresetBreakdown>;
  title?: string;
}) {
  const [pending, start] = useAction("load the program");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Kept while the sheet slides away, so it leaves showing what it showed.
  const [shownId, setShownId] = useState<string | null>(null);
  if (presets.length === 0) return null;
  const shown = presets.find((p) => p.id === shownId) ?? null;

  function choose(id: string) {
    setLoadingId(id);
    start(async () => {
      try {
        await loadPreset({ presetId: id });
        setOpenId(null);
      } finally {
        setLoadingId(null);
      }
    });
  }

  function programButton(p: Preset, className?: string, variant: "secondary" | "primary" = "secondary") {
    return (
      <Button variant={variant} className={className} disabled={pending} onClick={() => choose(p.id)}>
        {loadingId === p.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {loadingId === p.id ? "Loading" : "Use this program"}
      </Button>
    );
  }

  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 min-[400px]:-mx-5 min-[400px]:scroll-px-5 min-[400px]:px-5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
        {presets.map((p) => (
          <div
            key={p.id}
            className="hb-plate flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-surface [--hb-fade:var(--color-surface)] sm:w-auto"
          >
            <button
              type="button"
              onClick={() => {
                setShownId(p.id);
                setOpenId(p.id);
              }}
              aria-haspopup="dialog"
              className="flex flex-1 flex-col text-left transition-colors hover:bg-text/[0.02] active:bg-text/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text/30"
            >
              {/* The style's fighter fronts the card, with the style's name
                  set over the foot of the portrait. */}
              <span className="relative block h-40 w-full">
                <FighterArt fighterKey={p.fighter} variant="card" fade="bottom" className="absolute inset-0" />
                <span className="font-display absolute bottom-3 left-5 right-5 text-[1.375rem] leading-none text-text">
                  {p.name.split(" · ")[0]}
                </span>
              </span>
              <span className="flex flex-1 flex-col px-5 pt-3">
                <span className="text-[17px] font-semibold leading-snug tracking-[-0.015em] text-text">
                  {p.name.split(" · ")[1] ?? p.name}
                </span>
                <span className="tnum mt-1 text-[13px] text-muted">
                  {p.days.length} days a week, {p.weeks ?? 8} weeks,{" "}
                  {p.days.reduce((n, d) => n + d.exercises.length, 0)} exercises
                </span>
                <span className="mt-3 line-clamp-4 text-[14px] leading-[1.45] text-muted">{p.description}</span>
                <span className="mb-4 mt-3 inline-flex items-center gap-0.5 text-[14px] font-medium text-text">
                  See the program
                  <ChevronRight className="size-4 text-muted" />
                </span>
              </span>
            </button>
            <div className="px-5 pb-5">{programButton(p, "w-full")}</div>
          </div>
        ))}
      </div>

      <Sheet
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title={shown ? (shown.name.split(" · ")[1] ?? shown.name) : ""}
        footer={shown ? programButton(shown, "w-full", "primary") : null}
      >
        {shown && <PresetPreview preset={shown} breakdown={breakdowns?.[shown.id]} />}
      </Sheet>
    </section>
  );
}

const BANDS = [
  { key: "strength", label: "Strength", reps: "1-5 reps", tone: "bg-text" },
  { key: "hypertrophy", label: "Size", reps: "6-12", tone: "bg-text/50" },
  { key: "endurance", label: "Endurance", reps: "13+", tone: "bg-text/20" },
] as const;

/** A starter program in full, to read before using it. */
function PresetPreview({ preset, breakdown }: { preset: Preset; breakdown?: PresetBreakdown }) {
  const exercises = preset.days.reduce((n, d) => n + d.exercises.length, 0);
  return (
    <div className="px-5 pb-4">
      <p className="text-[13px] text-muted">{preset.name.split(" · ")[0]}</p>
      <p className="tnum mt-0.5 text-[13px] text-muted">
        {preset.days.length} days a week, {preset.weeks ?? 8} weeks, {exercises} exercises
        {breakdown ? `, ${breakdown.sets} sets a week` : ""}
      </p>
      <p className="mt-3 text-[15px] leading-6 text-text/80">{preset.description}</p>

      {breakdown && breakdown.sets > 0 && <RepMix breakdown={breakdown} />}
      {breakdown && breakdown.muscles.length > 0 && <MuscleSets breakdown={breakdown} />}

      {preset.days.map((day) => (
        <section key={day.name} className="mt-7">
          <h3 className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-semibold tracking-[-0.015em] text-text">{day.dayLabel}</span>
            <span className="shrink-0 text-[13px] text-muted">{day.name.split(":")[0]}</span>
          </h3>
          <ol className="tnum mt-2 divide-y divide-text/[0.07] border-y border-text/[0.14]">
            {day.exercises.map((ex, i) => (
              <li key={`${ex.name}-${i}`} className="flex items-baseline gap-3 px-1 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-text">{ex.name}</span>
                  {ex.note && <span className="block text-[13px] leading-5 text-muted">{ex.note}</span>}
                </span>
                <span className="shrink-0 text-[15px] text-text">
                  {ex.sets} <span className="text-muted">×</span> {ex.reps}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/**
 * How the week's sets split across rep ranges: one bar, each band as wide as
 * its share, named under it. The bands sweep in from the left as the sheet
 * opens, which is the only motion here.
 */
function RepMix({ breakdown }: { breakdown: PresetBreakdown }) {
  const total = breakdown.ranges.strength + breakdown.ranges.hypertrophy + breakdown.ranges.endurance;
  if (total === 0) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  const bands = BANDS.filter((b) => breakdown.ranges[b.key] > 0);
  return (
    <section className="mt-6 border-t-2 border-text/80 pt-3">
      <h3 className="text-[15px] font-semibold text-text">Where the sets go</h3>
      <p className="sr-only">
        {bands.map((b) => `${b.label}, ${b.reps}: ${pct(breakdown.ranges[b.key])}%`).join(". ")}
      </p>
      <div aria-hidden className="hb-grow-x mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full">
        {bands.map((b) => (
          <span key={b.key} className={b.tone} style={{ flexGrow: breakdown.ranges[b.key] }} />
        ))}
      </div>
      <dl aria-hidden className="mt-3 grid grid-cols-3 gap-2">
        {BANDS.map((b) => (
          <div key={b.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className={`size-2 shrink-0 rounded-sm ${b.tone}`} />
              <span className="truncate">{b.label}</span>
            </dt>
            <dd className="mt-1 flex items-baseline gap-0.5">
              <span className="font-display text-[1.25rem] leading-none text-text">
                {pct(breakdown.ranges[b.key])}
              </span>
              <span className="text-[12px] text-muted">%</span>
            </dd>
            <dd className="mt-0.5 text-[11px] text-muted">{b.reps}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Hard sets a week per muscle, most first. */
function MuscleSets({ breakdown }: { breakdown: PresetBreakdown }) {
  return (
    <section className="mt-6 border-t-2 border-text/80 pt-3">
      <h3 className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-text">Sets a week by muscle</span>
        <span className="text-[12px] text-muted">secondary counts half</span>
      </h3>
      <div className="mt-3">
        <MuscleSetBars rows={breakdown.muscles} label="sets a week" />
      </div>
    </section>
  );
}
