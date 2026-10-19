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
    return <div className="flex h-8 items-center text-[12px] text-muted">One session</div>;
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
    <div className="relative h-8">
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
 * Your most-trained lifts, one ruled line each: the name, its 12-week line,
 * today's estimated 1RM and the change. A quiet list to compare against the
 * lift open above; each line opens its lift there.
 */
export function LiftTrends({ lifts, unit, selected }: { lifts: LiftTrend[]; unit: Unit; selected?: string }) {
  if (lifts.length === 0) return null;
  return (
    <section>
      <SectionLabel action={<span className="text-[13px] text-muted">Est. 1RM, 12 weeks</span>}>
        Top lifts
      </SectionLabel>
      <ol className="divide-y divide-text/[0.08] border-y border-text/[0.12]">
        {lifts.map((l) => {
          const up = (l.changePct ?? 0) > 0;
          const down = (l.changePct ?? 0) < 0;
          const open = l.exerciseId === selected;
          return (
            <li key={l.exerciseId}>
              <Link
                href={`/progress?tab=exercise&exercise=${l.exerciseId}#lift`}
                aria-current={open ? "true" : undefined}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-x-4 px-1 py-3 transition-colors hover:bg-text/[0.03] active:bg-text/[0.05]"
              >
                <span className="min-w-0">
                  <span className={cn("block truncate text-[15px]", open ? "font-semibold text-text" : "text-text/85")}>
                    {l.name}
                  </span>
                  <span
                    className={cn(
                      "tnum mt-0.5 inline-flex items-center gap-0.5 text-[13px]",
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
                </span>
                <span className={open ? "text-text" : "text-muted"}>
                  <Sparkline values={l.points.map((p) => p.e1rm)} />
                </span>
                <span className="flex items-baseline justify-end gap-1">
                  <span className="font-display text-[1.25rem] leading-none text-text">
                    {trimNum(Math.round(toDisplayWeight(l.current, unit) * 2) / 2)}
                  </span>
                  <span className="text-[12px] text-muted">{unit}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
