import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import type { Exercise1RM } from "@/lib/data/analytics";

/**
 * Every logged lift with its all-time best estimated 1RM (Epley), strongest
 * first. A faint bar behind each row is scaled to the top lift, so the list
 * reads as a comparison, not just a column of numbers. Rows open that lift's
 * detail.
 */
export function OneRepMaxBoard({ rows, unit }: { rows: Exercise1RM[]; unit: Unit }) {
  if (rows.length === 0) return null;
  const max = rows[0]?.bestEst1rm || 1;

  return (
    <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
      {rows.map((r, i) => {
        const pct = Math.max(4, Math.round((r.bestEst1rm / max) * 100));
        return (
          <li key={r.exerciseId}>
            <Link
              href={`/progress?tab=exercise&exercise=${r.exerciseId}`}
              className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/[0.035]"
                style={{ width: `${pct}%` }}
              />
              <span className="tnum relative w-5 shrink-0 text-right text-[13px] text-muted/70">
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
    </ul>
  );
}
