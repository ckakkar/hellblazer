"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/page-header";
import { loadPreset } from "@/lib/actions/templates";
import type { Preset } from "@/lib/presets";

/**
 * Starter programs: a row you swipe through on a phone, a grid from `sm` up.
 * Loading one creates its templates and makes it the active program.
 */
export function PresetCarousel({
  presets,
  title = "Starter programs",
}: {
  presets: Preset[];
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  if (presets.length === 0) return null;

  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 min-[400px]:-mx-5 min-[400px]:scroll-px-5 min-[400px]:px-5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
        {presets.map((p) => (
          <div
            key={p.id}
            className="flex w-[82%] shrink-0 snap-start flex-col rounded-2xl bg-surface p-5 sm:w-auto"
          >
            <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em] text-text">
              {p.name}
            </h3>
            <p className="tnum mt-1 text-[13px] text-muted">
              {p.days.length} days a week, {p.weeks ?? 8} weeks,{" "}
              {p.days.reduce((n, d) => n + d.exercises.length, 0)} exercises
            </p>
            <p className="mt-3 line-clamp-4 text-[14px] leading-[1.45] text-muted">{p.description}</p>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              disabled={pending}
              onClick={() => {
                setLoadingId(p.id);
                start(async () => {
                  try {
                    await loadPreset({ presetId: p.id });
                  } finally {
                    setLoadingId(null);
                  }
                });
              }}
            >
              {loadingId === p.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {loadingId === p.id ? "Loading" : "Use this program"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
