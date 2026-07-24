import {
  addDays,
  differenceInCalendarWeeks,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfISOWeek,
} from "date-fns";
import type { SessionSummary } from "@/lib/data/sessions";

// Never render more than a trailing year, however long ago the user joined.
const HARD_MAX_WEEKS = 53;

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

// Working sets in a day → shade. Calibrated for one session/day: a light
// accessory day is faint, a big leg/back day is full accent.
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
 * GitHub-style contribution graph: one 7-day column per week, cells shaded by
 * that day's working sets across a 5-step accent ramp. The grid begins the week
 * the lifter joined (capped to a trailing year) and scrolls sideways as history
 * grows. Pure markup — no client JS.
 */
export function ConsistencyHeatmap({
  summaries,
  signupDate,
}: {
  summaries: SessionSummary[];
  signupDate: string | null;
}) {
  // Working sets per calendar day drive each cell's shade.
  const setsByDay = new Map<string, number>();
  for (const s of summaries) {
    if (!s.session_date) continue;
    setsByDay.set(
      s.session_date,
      (setsByDay.get(s.session_date) ?? 0) + Number(s.working_sets ?? 0),
    );
  }

  const today = new Date();
  const todayWeek = startOfISOWeek(today);
  const signup = signupDate ? parseISO(signupDate) : null;

  // Start the grid at the ISO week the user joined; fall back to a short window
  // for accounts with no signup timestamp. Cap veterans to a trailing year.
  let startWeek = signup ? startOfISOWeek(signup) : startOfISOWeek(addDays(today, -27));
  const floorWeek = startOfISOWeek(addDays(todayWeek, -7 * (HARD_MAX_WEEKS - 1)));
  if (startWeek < floorWeek) startWeek = floorWeek;

  const weeksSpan =
    differenceInCalendarWeeks(todayWeek, startWeek, { weekStartsOn: 1 }) + 1;

  const weeks: DayCell[][] = Array.from({ length: weeksSpan }).map((_, w) => {
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

  const trainedCount = weeks
    .flat()
    .filter((c) => !c.future && c.sets > 0).length;

  // Month labels, one group per run of columns sharing a month (no overlap).
  // Each column is a 12px cell + 3px gap = 15px wide.
  const monthGroups: { label: string; span: number }[] = [];
  for (const col of weeks) {
    const label = format(col[0].date, "MMM");
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthGroups.push({ label, span: 1 });
  }
  // Rows run Mon→Sun (ISO); GitHub labels Mon / Wed / Fri.
  const weekdayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Month labels */}
        <div className="flex gap-1.5">
          <div className="w-7 shrink-0" />
          <div className="flex">
            {monthGroups.map((g, i) => (
              <div
                key={i}
                style={{ width: g.span * 15 }}
                className="text-[10px] font-medium text-muted"
              >
                {g.span >= 2 ? g.label : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Weekday rail + cell grid */}
        <div className="mt-1 flex gap-1.5">
          <div className="flex w-7 shrink-0 flex-col gap-[3px]">
            {weekdayLabels.map((d, i) => (
              <span key={i} className="h-3 text-[9px] leading-3 text-muted">
                {d}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((cell) =>
                  cell.future ? (
                    // Upcoming days: shown as faint empty cells so every column
                    // keeps its full seven rows (no ragged right edge).
                    <div
                      key={cell.key}
                      title={`${format(cell.date, "EEE, MMM d")} · upcoming`}
                      className="size-3 rounded-[2px] opacity-40"
                      style={{
                        backgroundColor: LEVELS[0],
                        boxShadow: CELL_RING,
                      }}
                    />
                  ) : (
                    <div
                      key={cell.key}
                      title={`${format(cell.date, "EEE, MMM d")} · ${
                        cell.sets > 0 ? `${Math.round(cell.sets)} sets` : "rest"
                      }`}
                      className={`size-3 rounded-[2px] ${
                        cell.isToday && cell.sets === 0
                          ? "ring-1 ring-accent/60"
                          : ""
                      }`}
                      style={{
                        backgroundColor: LEVELS[level(cell.sets)],
                        boxShadow: CELL_RING,
                      }}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer: training-day count + Less→More legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-9">
          <span className="text-[11px] text-muted">
            <span className="font-mono text-text">{trainedCount}</span> training
            day{trainedCount === 1 ? "" : "s"}
            {signup ? ` since ${format(signup, "MMM yyyy")}` : ""}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted">
            Less
            {LEVELS.map((bg, i) => (
              <span
                key={i}
                className="size-3 rounded-[2px]"
                style={{ backgroundColor: bg, boxShadow: CELL_RING }}
              />
            ))}
            More
          </div>
        </div>
      </div>
    </div>
  );
}
