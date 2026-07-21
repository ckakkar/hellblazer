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
