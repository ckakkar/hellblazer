import type { CSSProperties } from "react";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { trimNum } from "@/lib/units";

/**
 * Sets per muscle, most first: a bar each on one scale (the busiest muscle's
 * is full), the figure at its end. Plain HTML, no chart library. The bars
 * draw in from the left one after another when it appears, the figure
 * arriving; with reduced motion they're simply there.
 */
export function MuscleSetBars({
  rows,
  label,
}: {
  rows: { muscle: Muscle; sets: number }[];
  /** What the figures are, for a screen reader: "sets this workout". */
  label: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.sets)) || 1;
  return (
    <ol className="tnum grid gap-1.5" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.muscle} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-3">
          <span className="truncate text-[13px] text-text/85">{MUSCLE_LABEL[r.muscle]}</span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-text/[0.06]">
            <span
              className="hb-grow-x block h-full rounded-full bg-text/70"
              style={{ width: `${Math.max(4, (r.sets / max) * 100)}%`, "--i": i } as CSSProperties}
            />
          </span>
          <span className="text-right text-[13px] text-text">
            {trimNum(Math.round(r.sets * 2) / 2)}
            <span className="sr-only"> {label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
