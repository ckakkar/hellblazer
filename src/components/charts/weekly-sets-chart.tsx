import { CHART_HIDDEN_MUSCLES, MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { cn } from "@/lib/utils";
import { ChartEmpty } from "./chart-kit";

type Row = { muscle: Muscle; sets: number };

/** The weekly range most growth comes from, in hard sets per muscle. */
const LOW = 10;
const HIGH = 20;

/**
 * Sets per muscle as horizontal bars on one scale, over a shaded 10-20 set
 * band: the weekly range most growth comes from. A muscle still under the
 * band reads dim, one inside it reads bright, so what needs work this week
 * is visible without reading numbers. Reads on a phone without rotated
 * labels, and needs no chart library.
 */
export function WeeklySetsChart({ data }: { data: Row[] }) {
  const rows = data
    .filter((d) => !CHART_HIDDEN_MUSCLES.has(d.muscle))
    .map((d) => ({
      muscle: d.muscle,
      label: MUSCLE_LABEL[d.muscle],
      sets: Math.round(d.sets * 10) / 10,
    }));

  const max = Math.max(0, ...rows.map((r) => r.sets));
  if (max === 0) {
    return <ChartEmpty message="No sets logged this week yet. Start a session to fill this in." />;
  }
  // Fixed headroom past the band, so the band sits in the same place every week.
  const scale = Math.max(HIGH + 4, max);
  const pct = (n: number) => `${(n / scale) * 100}%`;

  return (
    <div className="px-3 pb-3 pt-1">
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const inRange = r.sets >= LOW;
          return (
            <li key={r.muscle} className="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-3">
              <span className={cn("truncate text-[13px]", inRange ? "text-text" : "text-muted")}>
                {r.label}
              </span>
              <span className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                <span
                  aria-hidden
                  className="absolute inset-y-0 bg-white/[0.1]"
                  style={{ left: pct(LOW), width: pct(HIGH - LOW) }}
                />
                <span
                  className={cn(
                    "relative block h-full rounded-full",
                    inRange ? "bg-text/85" : "bg-white/30",
                  )}
                  style={{ width: r.sets > 0 ? `max(3%, ${pct(r.sets)})` : "0%" }}
                />
              </span>
              <span className={cn("tnum text-right text-[13px]", inRange ? "text-text" : "text-muted")}>
                {r.sets}
              </span>
            </li>
          );
        })}
      </ul>
      <div aria-hidden className="mt-2 grid grid-cols-[5.5rem_1fr_2.25rem] gap-3">
        <span />
        <span className="relative h-4 text-[11px] text-muted">
          <span className="absolute -translate-x-1/2" style={{ left: pct(LOW) }}>
            {LOW}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(HIGH) }}>
            {HIGH}
          </span>
        </span>
      </div>
    </div>
  );
}
