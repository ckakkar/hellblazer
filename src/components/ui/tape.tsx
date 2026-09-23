import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Stat rows ─────────────────────────────────────────────────────────────
   A grouped list of figures: label on the left, the number in the expanded
   cut on the right, and its move against last week beside it. The accent
   marks one thing only, ground gained; flat and losing weeks stay muted, so
   colour in this list always means the same thing. */

export type DeltaTone = "gain" | "flat" | "loss";

export function Delta({
  tone,
  children,
  className,
}: {
  tone: DeltaTone;
  children: React.ReactNode;
  className?: string;
}) {
  const glyph = tone === "gain" ? "↑" : tone === "loss" ? "↓" : "";
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-0.5 text-[13px] font-medium",
        tone === "gain" ? "text-accent" : "text-muted",
        className,
      )}
    >
      {glyph && <span aria-hidden>{glyph}</span>}
      {children}
    </span>
  );
}

export function Tape({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && (
        <h2 className="mb-3 px-1 text-[19px] font-semibold tracking-[-0.02em] text-text">
          {title}
        </h2>
      )}
      <dl className="divide-y divide-white/[0.06] rounded-2xl bg-surface px-4">
        {children}
      </dl>
    </section>
  );
}

export function TapeRow({
  label,
  value,
  unit,
  delta,
  note,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: React.ReactNode;
  /** Plain-language read on the figure, e.g. "one short of target". */
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <dt className="min-w-0 flex-1">
        <span className="block text-[15px] text-text">{label}</span>
        {note && <span className="mt-0.5 block text-[13px] text-muted">{note}</span>}
      </dt>
      <dd className="flex shrink-0 items-baseline gap-2.5">
        {delta}
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[22px] leading-none text-text">{value}</span>
          {unit && <span className="text-[13px] text-muted">{unit}</span>}
        </span>
      </dd>
    </div>
  );
}
