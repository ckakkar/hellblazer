"use client";

import type { ReactNode } from "react";

/** Shared tooltip shell: surface-2 with a 1px border, mono text. */
export function TooltipBox({
  label,
  children,
}: {
  label?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-xl">
      {label != null && (
        <div className="mb-1 text-[11px] font-medium text-muted">{label}</div>
      )}
      <div className="font-mono text-xs tabular-nums text-text">{children}</div>
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
 * whenever a label outgrows the gutter — which is exactly what happened to lb
 * bodyweights ("230.5" rendering as "30.5"). Pass the values and, if the axis
 * has one, the same tickFormatter the axis uses.
 *
 * 7px per character is the measured advance of the mono face at the 11px axis
 * size, plus room for the tick gap.
 */
export function axisWidthFor(
  values: number[],
  format: (v: number) => string = (v) => String(v),
): number {
  const widest = Math.max(2, ...values.map((v) => format(v).length));
  return Math.max(36, widest * 7 + 16);
}
