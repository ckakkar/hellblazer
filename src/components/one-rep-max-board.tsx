import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import type { Exercise1RM } from "@/lib/data/analytics";

/**
 * Strength leaderboard: every logged exercise with its all-time best estimated
 * 1RM (Epley), ranked strongest first. Each row carries a faint accent bar
 * scaled to the top lift, and links into that exercise's Progress deep-dive.
 */
export function OneRepMaxBoard({
  rows,
  unit,
}: {
  rows: Exercise1RM[];
  unit: Unit;
}) {
  if (rows.length === 0) return null;
  const max = rows[0]?.bestEst1rm || 1;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/70 px-5 py-3.5">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Estimated 1RM board
        </h3>
        <p className="mt-1 text-xs text-muted/80">
          All-time best est. 1RM per exercise · Epley · tap to open
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => {
          const pct = Math.max(5, Math.round((r.bestEst1rm / max) * 100));
          return (
            <li key={r.exerciseId}>
              <Link
                href={`/progress?tab=exercise&exercise=${r.exerciseId}`}
                className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                {/* strength bar, scaled to the strongest lift */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-accent/[0.06] transition-colors group-hover:bg-accent/[0.09]"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative w-5 shrink-0 text-right font-mono text-xs tabular-nums text-muted/70">
                  {i + 1}
                </span>
                <div className="relative min-w-0 flex-1">
                  <div className="truncate text-sm text-text">{r.name}</div>
                  <div className="truncate font-mono text-xs text-muted">
                    {MUSCLE_LABEL[r.primaryMuscle]} ·{" "}
                    {trimNum(toDisplayWeight(r.bestWeightKg, unit))}
                    {unit}×{r.bestReps}
                  </div>
                </div>
                <div className="relative shrink-0 text-right">
                  <div className="font-impact text-lg leading-none text-accent tabular-nums">
                    {trimNum(toDisplayWeight(r.bestEst1rm, unit))}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-muted">
                    {unit} 1RM
                  </div>
                </div>
                <ChevronRight className="relative size-4 shrink-0 text-muted/50 transition-colors group-hover:text-accent" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
