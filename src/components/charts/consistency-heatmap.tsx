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

// Beyond this many weeks of membership, switch from the roomy day-by-day
// calendar to the compact GitHub-style column grid (which scrolls sideways).
const ROOMY_MAX_WEEKS = 16;
// Never render more than a trailing year, however long ago the user joined.
const HARD_MAX_WEEKS = 53;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayCell = {
  date: Date;
  key: string;
  state: "trained" | "rest" | "blank"; // blank = before signup or in the future
  isToday: boolean;
  sets: number;
};

/**
 * A per-day training map. One mark per calendar day: solid accent when at least
 * one working set was logged, a faint rest cell otherwise. The grid begins the
 * week the lifter joined (not a fixed lookback) and, while that history is
 * short, renders a clear day-numbered calendar; once it grows past a few months
 * it falls back to a compact column grid. Pure markup — no client JS.
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
  const roomy = weeksSpan <= ROOMY_MAX_WEEKS;

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

  const trainedCount = weeks
    .flat()
    .filter((c) => c.state === "trained").length;

  const caption = (
    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted">
      <span>
        <span className="font-mono text-text">{trainedCount}</span> training day
        {trainedCount === 1 ? "" : "s"}
        {signup ? ` since ${format(signup, "MMM d, yyyy")}` : ""}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-[11px] rounded-[3px] bg-accent shadow-glow" />
        Trained
      </span>
    </div>
  );

  // ── Roomy calendar: responsive 7-column grid of day-numbered cells ────────
  if (roomy) {
    const cells = weeks.flat();
    return (
      <div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted/70"
            >
              {d.slice(0, 1)}
            </div>
          ))}
          {cells.map((c) =>
            c.state === "blank" ? (
              <div key={c.key} className="aspect-square" />
            ) : (
              <div
                key={c.key}
                title={`${format(c.date, "EEE, MMM d")} · ${
                  c.state === "trained"
                    ? `trained · ${Math.round(c.sets)} sets`
                    : "rest"
                }`}
                className={[
                  "flex aspect-square items-center justify-center rounded-md font-mono text-[11px] tabular-nums transition-colors",
                  c.state === "trained"
                    ? "bg-accent font-semibold text-bg shadow-glow"
                    : "border border-border bg-surface-2 text-muted/45",
                  c.isToday && c.state !== "trained"
                    ? "ring-1 ring-accent/50"
                    : "",
                ].join(" ")}
              >
                {format(c.date, "d")}
              </div>
            ),
          )}
        </div>
        {caption}
      </div>
    );
  }

  // ── Compact column grid: GitHub-style, one 13px cell per day ──────────────
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
          <div className="w-7 shrink-0" />
          <div className="flex">
            {monthGroups.map((g, i) => (
              <div
                key={i}
                style={{ width: g.span * 16 }}
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
              <span key={i} className="h-[13px] text-[9px] leading-[13px] text-muted">
                {d}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((cell) =>
                  cell.state === "blank" ? (
                    <div key={cell.key} className="size-[13px]" />
                  ) : (
                    <div
                      key={cell.key}
                      title={`${format(cell.date, "EEE, MMM d")} · ${
                        cell.state === "trained"
                          ? `trained · ${Math.round(cell.sets)} sets`
                          : "rest"
                      }`}
                      className={`size-[13px] rounded-[3px] ${
                        cell.state === "trained"
                          ? "bg-accent"
                          : "border border-border/60 bg-surface-2"
                      } ${cell.isToday && cell.state !== "trained" ? "ring-1 ring-accent/50" : ""}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        {caption}
      </div>
    </div>
  );
}
