import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LiftTrend } from "@/lib/data/analytics";
import { toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import { SectionLabel } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

/**
 * A line with no axes, for reading a direction at a glance. Server-rendered
 * SVG: the path stretches to the box and keeps a hairline stroke, and the
 * latest point is an HTML dot so it stays round at any aspect ratio.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="flex h-10 items-center text-[12px] text-muted">One session so far</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  // 12% headroom top and bottom so the line never scrapes the edges.
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * 100,
    y: 88 - ((v - min) / span) * 76,
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div className="relative h-10">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <path d={`${line} L100 100 L0 100 Z`} fill="currentColor" opacity="0.07" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text"
        style={{ left: `${last.x}%`, top: `${last.y}%` }}
      />
    </div>
  );
}

/**
 * Your most-trained lifts as small multiples: today's estimated 1RM, its
 * 12-week line, and the change over that window. Each opens the lift's deep
 * dive below.
 */
export function LiftTrends({ lifts, unit }: { lifts: LiftTrend[]; unit: Unit }) {
  if (lifts.length === 0) return null;
  return (
    <section>
      <SectionLabel action={<span className="text-[13px] text-muted">Est. 1RM, 12 weeks</span>}>
        Top lifts
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {lifts.map((l) => {
          const up = (l.changePct ?? 0) > 0;
          const down = (l.changePct ?? 0) < 0;
          return (
            <Link
              key={l.exerciseId}
              href={`/progress?tab=exercise&exercise=${l.exerciseId}#lift`}
              className="flex min-w-0 flex-col rounded-2xl bg-surface p-4 text-text transition-colors hover:bg-surface-2 active:bg-surface-2"
            >
              <span className="truncate text-[13px] text-muted">{l.name}</span>
              <span className="mt-1.5 flex items-baseline gap-1">
                <span className="font-display text-[1.625rem] leading-none">
                  {trimNum(Math.round(toDisplayWeight(l.current, unit) * 2) / 2)}
                </span>
                <span className="text-[13px] text-muted">{unit}</span>
              </span>
              <div className="mt-3">
                <Sparkline values={l.points.map((p) => p.e1rm)} />
              </div>
              <span
                className={cn(
                  "tnum mt-2.5 inline-flex items-center gap-0.5 text-[13px]",
                  up ? "text-text" : "text-muted",
                )}
              >
                {l.changePct === null ? (
                  "New this block"
                ) : l.changePct === 0 ? (
                  "Holding"
                ) : (
                  <>
                    {up && <ArrowUpRight className="size-3.5" />}
                    {down && <ArrowDownRight className="size-3.5" />}
                    {Math.abs(l.changePct)}%
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
