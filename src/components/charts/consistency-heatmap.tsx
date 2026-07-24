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

type DayCell = {
  date: Date;
  key: string;
  state: "trained" | "rest" | "blank"; // blank = before signup or in the future
  isToday: boolean;
  sets: number;
};

/**
 * GitHub-style training grid: one 7-day column per week, strongest signal being
 * a single binary mark — a solid accent square on any day at least one working
 * set was logged, a faint bordered cell on rest days. The grid begins the week
 * the lifter joined (not a fixed lookback) and scrolls sideways as the history
 * grows past a year. Pure markup — no client JS, no intensity ramp.
 */
export function ConsistencyHeatmap({
  summaries,
  signupDate,
}: {
  summaries: SessionSummary[];
  signupDate: string | null;
}) {
  // Working sets per calendar day → a day counts as "trained" when > 0.
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
  const signupKey = signup ? format(signup, "yyyy-MM-dd") : null;

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
      const future = isAfter(date, today);
      const beforeSignup = signupKey ? key < signupKey : false;
      const sets = setsByDay.get(key) ?? 0;
      // A logged day always shows, even if a local-timezone date lands a hair
      // ahead of the server's UTC "today" (past-midnight training).
      const state: DayCell["state"] =
        sets > 0 ? "trained" : future || beforeSignup ? "blank" : "rest";
      return { date, key, state, isToday: isSameDay(date, today), sets };
    });
  });

  const trainedCount = weeks.flat().filter((c) => c.state === "trained").length;

  // Month labels, one group per run of columns sharing a month (no overlap).
  // Each column is 16px cell + 3px gap = 19px wide.
  const monthGroups: { label: string; span: number }[] = [];
  for (const col of weeks) {
    const label = format(col[0].date, "MMM");
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthGroups.push({ label, span: 1 });
  }
  const weekdayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-2">
          <div className="w-8 shrink-0" />
          <div className="flex">
            {monthGroups.map((g, i) => (
              <div
                key={i}
                style={{ width: g.span * 19 }}
                className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted"
              >
                {g.span >= 2 ? g.label : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 flex gap-2">
          <div className="flex w-8 shrink-0 flex-col gap-[3px] pt-[1px]">
            {weekdayLabels.map((d, i) => (
              <span key={i} className="h-4 text-[10px] leading-4 text-muted">
                {d}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((cell) =>
                  cell.state === "blank" ? (
                    <div key={cell.key} className="size-4" />
                  ) : (
                    <div
                      key={cell.key}
                      title={`${format(cell.date, "EEE, MMM d")} · ${
                        cell.state === "trained"
                          ? `trained · ${Math.round(cell.sets)} sets`
                          : "rest"
                      }`}
                      className={`size-4 rounded-[4px] ${
                        cell.state === "trained"
                          ? "bg-accent shadow-glow"
                          : "border border-border/70 bg-surface-2"
                      } ${
                        cell.isToday && cell.state !== "trained"
                          ? "ring-1 ring-accent/50"
                          : ""
                      }`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 pl-10 text-[11px] text-muted">
          <span>
            <span className="font-mono text-text">{trainedCount}</span> training
            day{trainedCount === 1 ? "" : "s"}
            {signup ? ` since ${format(signup, "MMM d, yyyy")}` : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-4 rounded-[4px] bg-accent shadow-glow" />
            Trained
          </span>
        </div>
      </div>
    </div>
  );
}
