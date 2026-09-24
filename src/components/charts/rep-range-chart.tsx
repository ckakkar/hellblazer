import { format, parseISO } from "date-fns";
import type { RepRangeWeek } from "@/lib/data/analytics";
import { ChartEmpty } from "./chart-kit";

const BANDS = [
  { key: "strength", label: "Strength", reps: "1-5 reps", tone: "bg-text" },
  { key: "hypertrophy", label: "Hypertrophy", reps: "6-12", tone: "bg-text/50" },
  { key: "endurance", label: "Endurance", reps: "13+", tone: "bg-text/20" },
] as const;

/**
 * How your working sets split across rep ranges, week by week: a stacked bar
 * per week (its height is the week's set count) and the window's overall mix
 * underneath. Answers "is this block actually strength work?" at a glance.
 * Plain HTML, no chart library.
 */
export function RepRangeChart({ weeks }: { weeks: RepRangeWeek[] }) {
  const totals = weeks.map((w) => w.strength + w.hypertrophy + w.endurance);
  const max = Math.max(0, ...totals);
  if (max === 0) {
    return <ChartEmpty message="Log some working sets and your rep-range mix shows up here." />;
  }
  const sum = (k: (typeof BANDS)[number]["key"]) => weeks.reduce((n, w) => n + w[k], 0);
  const all = totals.reduce((n, t) => n + t, 0);

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex h-40 items-end gap-2" role="img" aria-label="Working sets per week by rep range">
        {weeks.map((w, i) => (
          <div key={w.week} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="flex flex-col-reverse overflow-hidden rounded-md"
              style={{ height: `${(totals[i] / max) * 100}%` }}
              title={`${totals[i]} sets`}
            >
              {BANDS.map((b) =>
                w[b.key] > 0 ? (
                  <div key={b.key} className={b.tone} style={{ height: `${(w[b.key] / totals[i]) * 100}%` }} />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2" aria-hidden>
        {weeks.map((w, i) => (
          <span key={w.week} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted">
            {i === weeks.length - 1 ? "Now" : i % 2 === 0 ? format(parseISO(w.week), "d MMM") : ""}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        {BANDS.map((b) => (
          <div key={b.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className={`size-2 shrink-0 rounded-sm ${b.tone}`} />
              <span className="truncate">{b.label}</span>
            </dt>
            <dd className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-[1.125rem] leading-none text-text">
                {Math.round((sum(b.key) / all) * 100)}%
              </span>
              <span className="truncate text-[11px] text-muted">{b.reps}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
