import { Fragment } from "react";
import { addDays, format, isAfter, isSameDay, startOfISOWeek, subWeeks } from "date-fns";
import type { SessionSummary } from "@/lib/data/sessions";

// Render a full trailing year; mobile reveals the recent 6 months, desktop the
// whole 52 weeks (responsive via CSS, since this is a server component).
const WEEKS = 52;
const MOBILE_WEEKS = 26;
const OLD = WEEKS - MOBILE_WEEKS; // columns hidden on mobile

const LEVELS = [
  "var(--color-surface-2)",
  "rgb(var(--accent-rgb) / 0.30)",
  "rgb(var(--accent-rgb) / 0.52)",
  "rgb(var(--accent-rgb) / 0.78)",
  "rgb(var(--accent-rgb))",
];
const CELL_RING = "inset 0 0 0 1px rgb(255 255 255 / 0.04)";

function level(sets: number): number {
  if (sets <= 0) return 0;
  if (sets <= 8) return 1;
  if (sets <= 14) return 2;
  if (sets <= 20) return 3;
  return 4;
}

type DayCell = {
  date: Date;
  key: string;
  sets: number;
  future: boolean;
  isToday: boolean;
};

function monthGroups(slice: DayCell[][]): { label: string; span: number }[] {
  const groups: { label: string; span: number }[] = [];
  for (const col of slice) {
    const label = format(col[0].date, "MMM");
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.span += 1;
    else groups.push({ label, span: 1 });
  }
  return groups;
}

/**
 * GitHub-style contribution graph. The week columns are fluid `1fr` tracks that
 * fill the card's width; mobile shows the recent six months, desktop the full
 * year (the older columns just reveal at `lg`). Pure markup.
 */
export function ConsistencyHeatmap({
  summaries,
}: {
  summaries: SessionSummary[];
}) {
  const setsByDay = new Map<string, number>();
  for (const s of summaries) {
    if (!s.session_date) continue;
    setsByDay.set(
      s.session_date,
      (setsByDay.get(s.session_date) ?? 0) + Number(s.working_sets ?? 0),
    );
  }

  const today = new Date();
  const startWeek = startOfISOWeek(subWeeks(today, WEEKS - 1));

  const weeks: DayCell[][] = Array.from({ length: WEEKS }).map((_, w) => {
    const monday = addDays(startWeek, w * 7);
    return Array.from({ length: 7 }).map((__, d) => {
      const date = addDays(monday, d);
      const key = format(date, "yyyy-MM-dd");
      return {
        date,
        key,
        sets: setsByDay.get(key) ?? 0,
        future: isAfter(date, today),
        isToday: isSameDay(date, today),
      };
    });
  });

  const trained = (slice: DayCell[][]) =>
    slice.flat().filter((c) => !c.future && c.sets > 0).length;
  const trainedYear = trained(weeks);
  const trained6mo = trained(weeks.slice(OLD));

  const monthsMobile = monthGroups(weeks.slice(OLD));
  const monthsDesktop = monthGroups(weeks);
  const weekdayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  const monthCell = (g: { label: string; span: number }, i: number) => (
    <div
      key={i}
      style={{ gridColumn: `span ${g.span}` }}
      className="overflow-hidden text-[10px] font-medium text-muted"
    >
      {g.span >= 2 ? g.label : ""}
    </div>
  );

  return (
    <div className="w-full">
      {/* Month labels — recent 6mo (mobile) / full year (desktop) */}
      <div className="grid gap-[3px] grid-cols-[1.75rem_repeat(26,minmax(0,1fr))] lg:hidden">
        <div />
        {monthsMobile.map(monthCell)}
      </div>
      <div className="hidden gap-[3px] lg:grid lg:grid-cols-[1.75rem_repeat(52,minmax(0,1fr))]">
        <div />
        {monthsDesktop.map(monthCell)}
      </div>

      {/* Weekday rail + fluid cell grid */}
      <div className="mt-1 grid gap-[3px] grid-cols-[1.75rem_repeat(26,minmax(0,1fr))] lg:grid-cols-[1.75rem_repeat(52,minmax(0,1fr))]">
        {weekdayLabels.map((label, row) => (
          <Fragment key={row}>
            <div className="flex items-center text-[10px] leading-none text-muted">
              {label}
            </div>
            {weeks.map((col, w) => {
              const cell = col[row];
              const hide = w < OLD ? "hidden lg:block" : "";
              return cell.future ? (
                <div
                  key={cell.key}
                  title={`${format(cell.date, "EEE, MMM d")} · upcoming`}
                  className={`aspect-square rounded-[3px] opacity-40 ${hide}`}
                  style={{ backgroundColor: LEVELS[0], boxShadow: CELL_RING }}
                />
              ) : (
                <div
                  key={cell.key}
                  title={`${format(cell.date, "EEE, MMM d")} · ${
                    cell.sets > 0 ? `${Math.round(cell.sets)} sets` : "rest"
                  }`}
                  className={`aspect-square rounded-[3px] ${
                    cell.isToday && cell.sets === 0 ? "ring-1 ring-accent/60" : ""
                  } ${hide}`}
                  style={{
                    backgroundColor: LEVELS[level(cell.sets)],
                    boxShadow: CELL_RING,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* Footer: training-day count + Less→More legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-7 text-[11px] text-muted">
        <span className="lg:hidden">
          <span className="font-mono text-text">{trained6mo}</span> training
          day{trained6mo === 1 ? "" : "s"} · last 6 months
        </span>
        <span className="hidden lg:inline">
          <span className="font-mono text-text">{trainedYear}</span> training
          day{trainedYear === 1 ? "" : "s"} · last year
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          Less
          {LEVELS.map((bg, i) => (
            <span
              key={i}
              className="size-3 rounded-[3px]"
              style={{ backgroundColor: bg, boxShadow: CELL_RING }}
            />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
