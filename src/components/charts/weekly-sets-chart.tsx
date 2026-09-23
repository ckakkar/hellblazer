import {
  CHART_HIDDEN_MUSCLES,
  MUSCLE_LABEL,
  isWeakPoint,
  type Muscle,
} from "@/lib/muscles";
import { cn } from "@/lib/utils";
import { ChartEmpty } from "./chart-kit";

type Row = { muscle: Muscle; sets: number };

/**
 * Sets per muscle as horizontal bars on one scale. Reads on a phone without
 * rotated axis labels, shows every value outright, and needs no chart
 * library. Weak points are drawn in bone; the rest recede.
 */
export function WeeklySetsChart({ data }: { data: Row[] }) {
  const rows = data
    .filter((d) => !CHART_HIDDEN_MUSCLES.has(d.muscle))
    .map((d) => ({
      muscle: d.muscle,
      label: MUSCLE_LABEL[d.muscle],
      sets: Math.round(d.sets * 10) / 10,
      weak: isWeakPoint(d.muscle),
    }));

  const max = Math.max(0, ...rows.map((r) => r.sets));
  if (max === 0) {
    return <ChartEmpty message="No sets logged this week yet. Start a session to fill this in." />;
  }

  return (
    <ul className="space-y-2.5 px-3 pb-3 pt-1">
      {rows.map((r) => (
        <li key={r.muscle} className="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-3">
          <span className={cn("truncate text-[13px]", r.weak ? "text-text" : "text-muted")}>
            {r.label}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className={cn("block h-full rounded-full", r.weak ? "bg-text/85" : "bg-white/25")}
              style={{ width: `${r.sets > 0 ? Math.max(3, (r.sets / max) * 100) : 0}%` }}
            />
          </span>
          <span className={cn("tnum text-right text-[13px]", r.weak ? "text-text" : "text-muted")}>
            {r.sets}
          </span>
        </li>
      ))}
    </ul>
  );
}
