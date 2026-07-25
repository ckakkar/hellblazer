import { Fragment } from "react";
import { addDays, format, isAfter, isSameDay, startOfISOWeek, subWeeks } from "date-fns";
import type { SessionSummary } from "@/lib/data/sessions";

// Trailing window, GitHub-style. 26 weeks ≈ 6 months.
const WEEKS = 26;

// GitHub-style 5-step contribution ramp, keyed off the active accent so it
// re-skins with the theme. Level 0 is an empty rest cell.
const LEVELS = [
  "var(--color-surface-2)",
  "rgb(var(--accent-rgb) / 0.30)",
  "rgb(var(--accent-rgb) / 0.52)",
  "rgb(var(--accent-rgb) / 0.78)",
  "rgb(var(--accent-rgb))",
];
// Faint hairline on every cell, exactly like GitHub's subtle square outline.
const CELL_RING = "inset 0 0 0 1px rgb(255 255 255 / 0.04)";

// Working sets in a day → shade.
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

/**
 * GitHub-style contribution graph over a trailing six-month window. The grid is
 * fluid — its week columns stretch to fill the card's width (chunky on desktop,
 * compact on mobile) rather than sitting fixed-size in a corner. Pure markup.
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

  const trainedCount = weeks.flat().filter((c) => !c.future && c.sets > 0).length;

  // Month labels, one group per run of columns sharing a month.
  const monthGroups: { label: string; span: number }[] = [];
  for (const col of weeks) {
    const label = format(col[0].date, "MMM");
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthGroups.push({ label, span: 1 });
  }
  // Rows run Mon→Sun (ISO); GitHub labels Mon / Wed / Fri.
  const weekdayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  // rail column + one fluid track per week — stretches to fill the card.
  const cols = `1.75rem repeat(${WEEKS}, minmax(0, 1fr))`;

  return (
    <div className="w-full">
      {/* Month labels */}
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: cols }}>
        <div />
        {monthGroups.map((g, i) => (
          <div
            key={i}
            style={{ gridColumn: `span ${g.span}` }}
            className="overflow-hidden text-[10px] font-medium text-muted"
          >
            {g.span >= 2 ? g.label : ""}
          </div>
        ))}
      </div>

      {/* Weekday rail + fluid cell grid */}
      <div
        className="mt-1 grid gap-[3px]"
        style={{ gridTemplateColumns: cols }}
      >
        {weekdayLabels.map((label, row) => (
          <Fragment key={row}>
            <div className="flex items-center text-[10px] leading-none text-muted">
              {label}
            </div>
            {weeks.map((col) => {
              const cell = col[row];
              return cell.future ? (
                <div
                  key={cell.key}
                  title={`${format(cell.date, "EEE, MMM d")} · upcoming`}
                  className="aspect-square rounded-[3px] opacity-40"
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
                  }`}
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
        <span>
          <span className="font-mono text-text">{trainedCount}</span> training
          day{trainedCount === 1 ? "" : "s"} · last 6 months
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
