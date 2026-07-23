import { addDays, format, isAfter, startOfISOWeek, subWeeks } from "date-fns";
import type { SessionSummary } from "@/lib/data/sessions";
import { formatVolume, type Unit } from "@/lib/units";

const WEEKS = 17;
const LEVEL_BG = [
  "var(--color-surface-2)",
  "rgba(255,45,58,0.22)",
  "rgba(255,45,58,0.42)",
  "rgba(255,45,58,0.66)",
  "rgba(255,45,58,1)",
];

function level(sets: number): number {
  if (sets <= 0) return 0;
  if (sets <= 9) return 1;
  if (sets <= 17) return 2;
  if (sets <= 25) return 3;
  return 4;
}

/**
 * GitHub-style training grid: one cell per day for the last 17 weeks, crimson
 * intensity scaled by that day's working sets. Pure markup + title tooltips —
 * no client JS.
 */
export function ConsistencyHeatmap({
  summaries,
  unit,
}: {
  summaries: SessionSummary[];
  unit: Unit;
}) {
  const byDay = new Map<string, { sets: number; volume: number }>();
  for (const s of summaries) {
    if (!s.session_date) continue;
    const cur = byDay.get(s.session_date) ?? { sets: 0, volume: 0 };
    cur.sets += Number(s.working_sets ?? 0);
    cur.volume += Number(s.total_volume ?? 0);
    byDay.set(s.session_date, cur);
  }

  const today = new Date();
  const start = startOfISOWeek(subWeeks(today, WEEKS - 1));
  const weekdayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  const columns = Array.from({ length: WEEKS }).map((_, w) => {
    const monday = addDays(start, w * 7);
    const cells = Array.from({ length: 7 }).map((__, d) => {
      const date = addDays(monday, d);
      const key = format(date, "yyyy-MM-dd");
      const hit = byDay.get(key);
      return { date, key, future: isAfter(date, today), sets: hit?.sets ?? 0, volume: hit?.volume ?? 0 };
    });
    return { monday, cells };
  });

  const trainedDays = [...byDay.values()].filter((d) => d.sets > 0).length;

  // Month labels, grouped so each spans its own columns (no overlap). Each
  // column is 12px cell + 3px gap = 15px wide.
  const monthGroups: { label: string; span: number }[] = [];
  for (const c of columns) {
    const label = format(c.monday, "MMM");
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthGroups.push({ label, span: 1 });
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-2">
          <div className="w-7 shrink-0" />
          <div className="flex">
            {monthGroups.map((g, i) => (
              <div
                key={i}
                style={{ width: g.span * 15 }}
                className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted"
              >
                {g.span >= 2 ? g.label : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 flex gap-2">
          <div className="flex w-7 shrink-0 flex-col gap-[3px] pt-[1px]">
            {weekdayLabels.map((d, i) => (
              <span key={i} className="h-3 text-[9px] leading-3 text-muted">
                {d}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.cells.map((cell) =>
                  cell.future ? (
                    <div key={cell.key} className="size-3" />
                  ) : (
                    <div
                      key={cell.key}
                      title={`${format(cell.date, "EEE, MMM d")} · ${
                        cell.sets > 0
                          ? `${Math.round(cell.sets)} sets · ${formatVolume(cell.volume, unit)}`
                          : "rest"
                      }`}
                      className="size-3 rounded-[3px] ring-1 ring-inset ring-white/[0.03]"
                      style={{ backgroundColor: LEVEL_BG[level(cell.sets)] }}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 pl-9">
          <span className="text-[11px] text-muted">
            <span className="font-mono text-text">{trainedDays}</span> training
            days in {WEEKS} weeks
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            Less
            {LEVEL_BG.map((bg, i) => (
              <span
                key={i}
                className="size-3 rounded-[3px] ring-1 ring-inset ring-white/[0.03]"
                style={{ backgroundColor: bg }}
              />
            ))}
            More
          </div>
        </div>
      </div>
    </div>
  );
}
