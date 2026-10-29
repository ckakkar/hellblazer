"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";

/** Shared tooltip shell: a raised surface with tabular figures. */
export function TooltipBox({
  label,
  children,
}: {
  label?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2 shadow-raised">
      {label != null && (
        <div className="mb-1 text-[13px] font-medium text-muted">{label}</div>
      )}
      <div className="tnum text-[13px] font-medium text-text">{children}</div>
    </div>
  );
}

export const AXIS_TICK = { fill: "var(--color-muted)", fontSize: 11 } as const;
export const GRID_STROKE = "var(--color-border)";

/** Centered empty-state for charts with no data yet. */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center px-6 text-center text-sm text-muted">
      {message}
    </div>
  );
}

/**
 * Width for a Y-axis gutter, sized to the widest label it actually has to
 * hold.
 *
 * The charts used to pair a fixed `width` with a negative left margin to
 * reclaim recharts' default padding. That silently clips the leading character
 * whenever a label outgrows the gutter, which is exactly what happened to lb
 * bodyweights ("230.5" rendering as "30.5"). Pass the values and, if the axis
 * has one, the same tickFormatter the axis uses.
 *
 * 7px per character covers Archivo's tabular figures at the 11px axis size,
 * plus room for the tick gap.
 */
export function axisWidthFor(
  values: number[],
  format: (v: number) => string = (v) => String(v),
): number {
  const widest = Math.max(2, ...values.map((v) => format(v).length));
  return Math.max(36, widest * 7 + 16);
}

/**
 * Axis labels for a chart keyed by ISO date: "3 Mar", or "Mar 25" once the
 * points span more than one year, so two 1 Januarys can't be confused.
 */
export function dateTick(dates: string[]): (iso: string) => string {
  const years = new Set(dates.map((d) => d.slice(0, 4)));
  return (iso) => format(parseISO(iso), years.size > 1 ? "MMM yy" : "d MMM");
}

/** A point's date in a tooltip or a summary: always with its year. */
export const fullDate = (iso: string) => format(parseISO(iso), "d MMM yyyy");

