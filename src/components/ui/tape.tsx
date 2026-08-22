import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Tale of the tape ──────────────────────────────────────────────────────
   The signature block. A fight card states its numbers as a bracketed table
   with both corners side by side, never as a row of equal boxes, so this is a
   rule-bracketed table rather than a StatCard grid: label, figure, and the
   move against last week on one line each.

   The accent earns its place here. It marks exactly one thing — ground gained
   on the previous week — which is why the palette can afford to stay otherwise
   monochrome. Flat and losing weeks are set in muted, so a red line in the
   tape always means the same thing at a glance. */

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
  const glyph = tone === "gain" ? "▲" : tone === "loss" ? "▼" : "—";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 font-mono text-[11px] tabular-nums",
        tone === "gain" ? "text-accent" : "text-muted",
        className,
      )}
    >
      <span aria-hidden className="text-[9px] leading-none">
        {glyph}
      </span>
      {children}
    </span>
  );
}

export function Tape({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative", className)}>
      {/* Double rule: a heavy bar over a hairline. Poster furniture, and it
          gives the block a top edge strong enough to hold the page without
          wrapping everything in another bordered box. */}
      <div className="h-0.5 bg-text/85" />
      <div className="mt-px h-px bg-border" />
      <h2 className="px-0.5 pt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        {title}
      </h2>
      <dl className="mt-1">{children}</dl>
      <div className="h-px bg-border" />
      <div className="mt-px h-0.5 bg-text/85" />
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
    <div className="flex items-baseline gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <dt className="w-[6.75rem] shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:w-28">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-1.5">
          <span className="font-impact text-2xl leading-none tabular-nums text-text sm:text-[1.75rem]">
            {value}
          </span>
          {unit && (
            <span className="font-mono text-[11px] lowercase text-muted">
              {unit}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-baseline gap-2 text-right">
          {note && (
            <span className="hidden font-mono text-[11px] text-muted sm:inline">
              {note}
            </span>
          )}
          {delta}
        </span>
      </dd>
    </div>
  );
}

/* ── Weak-point bars ───────────────────────────────────────────────────────
   Four numbers on a shared scale, which is the one thing four separate stat
   cards could never show: whether a muscle is actually behind the others. The
   bar is the comparison, so it carries information the figure alone doesn't —
   unlike a rank bar whose width just restates the rank beside it. */
export function BarRow({
  label,
  value,
  max,
  unit = "sets",
  low,
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
  /** Trailing the pack: the one state worth spending the accent on. */
  low?: boolean;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-[6.75rem] shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:w-28">
        {label}
      </span>
      <span className="relative h-2.5 min-w-0 flex-1 bg-surface-2">
        <span
          className={cn(
            "absolute inset-y-0 left-0",
            low ? "bg-accent" : "bg-text/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={cn(
          "w-12 shrink-0 text-right font-mono text-xs tabular-nums",
          low ? "text-accent" : "text-text",
        )}
      >
        {value}
      </span>
      <span className="hidden w-8 shrink-0 font-mono text-[10px] lowercase text-muted sm:inline">
        {unit}
      </span>
    </div>
  );
}
