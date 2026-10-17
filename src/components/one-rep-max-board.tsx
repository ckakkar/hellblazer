import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import type { Exercise1RM } from "@/lib/data/analytics";
import { cn } from "@/lib/utils";

/**
 * Every logged lift with its all-time best estimated 1RM (Epley), strongest
 * first. A faint bar behind each row is scaled to the top lift, so the list
 * reads as a comparison, not just a column of numbers. Rows open that lift's
 * detail.
 */
export function OneRepMaxBoard({
  rows,
  unit,
  selected,
}: {
  rows: Exercise1RM[];
  unit: Unit;
  /** The lift whose detail is open, marked where the list sits beside it. */
  selected?: string;
}) {
  if (rows.length === 0) return null;
  const max = rows[0]?.bestEst1rm || 1;

  return (
    // Two columns on a desktop, filled top to bottom so the ranking reads down
    // the first and carries on in the second.
    <ul
      className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface lg:grid lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-[repeat(var(--rows),auto)] lg:gap-px lg:divide-y-0 lg:bg-white/[0.06]"
      style={{ "--rows": Math.ceil(rows.length / 2) } as React.CSSProperties}
    >
      {rows.map((r, i) => {
        const pct = Math.max(4, Math.round((r.bestEst1rm / max) * 100));
        const open = r.exerciseId === selected;
        return (
          <li key={r.exerciseId} className="lg:bg-surface">
            <Link
              href={`/progress?tab=exercise&exercise=${r.exerciseId}`}
              aria-current={open ? "true" : undefined}
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]",
                open && "lg:shadow-[inset_3px_0_0_var(--color-text)]",
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/[0.035]"
                style={{ width: `${pct}%` }}
              />
              <span className="tnum relative w-5 shrink-0 text-right text-[13px] text-muted">
                {i + 1}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[15px] text-text">{r.name}</span>
                <span className="tnum block truncate text-[13px] text-muted">
                  {MUSCLE_LABEL[r.primaryMuscle]}, best {trimNum(toDisplayWeight(r.bestWeightKg, unit))}
                  {unit} × {r.bestReps}
                </span>
              </span>
              <span className="relative shrink-0 text-right">
                <span className="font-display block text-[19px] leading-none text-text">
                  {trimNum(toDisplayWeight(r.bestEst1rm, unit))}
                </span>
                <span className="block text-[12px] text-muted">{unit}</span>
              </span>
              <ChevronRight className="relative size-4 shrink-0 text-muted/50" />
            </Link>
          </li>
        );
      })}
      {/* Squares off an odd count, so the second column doesn't end on a gap. */}
      {rows.length % 2 === 1 && <li aria-hidden className="hidden lg:block lg:bg-surface" />}
    </ul>
  );
}
