import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Zap } from "lucide-react";
import type { RecentRecord } from "@/lib/data/analytics";
import { toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import { SectionLabel } from "@/components/ui/page-header";

/**
 * Your latest personal records, newest first: the lift, what kind of record,
 * the new number and what it beat. Each opens the session it happened in. A
 * record is the one datum the accent is for.
 */
export function RecentRecords({ records, unit }: { records: RecentRecord[]; unit: Unit }) {
  if (records.length === 0) return null;
  const w = (kg: number) => trimNum(Math.round(toDisplayWeight(kg, unit) * 2) / 2);
  return (
    <section>
      <SectionLabel>Recent records</SectionLabel>
      <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
        {records.map((r) => (
          <li key={`${r.sessionId}-${r.exerciseId}`}>
            <Link
              href={`/history/${r.sessionId}`}
              transitionTypes={["nav-forward"]}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Zap className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-text">{r.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {r.kind === "weight" ? "Heaviest set" : "Best est. 1RM"}, {format(parseISO(r.date), "d MMM")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="flex items-baseline justify-end gap-1">
                  <span className="font-display text-[1.125rem] leading-none text-text">{w(r.value)}</span>
                  <span className="text-[12px] text-muted">{unit}</span>
                </span>
                <span className="tnum mt-1 block text-[12px] text-muted">
                  was {w(r.previous)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
