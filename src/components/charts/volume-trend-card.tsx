"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  format,
  parseISO,
  startOfISOWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { kgToLb, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { ChartEmpty } from "./chart-kit";

/** One calendar day of lifted tonnage, canonical kg. */
export type DayVolume = { date: string; volumeKg: number };

type RangeKey = "7d" | "30d" | "1y";
const RANGES: { key: RangeKey; label: string; sub: string }[] = [
  { key: "7d", label: "7D", sub: "Daily, last 7 days" },
  { key: "30d", label: "30D", sub: "Daily, last 30 days" },
  { key: "1y", label: "1Y", sub: "Weekly, last 52 weeks" },
];

type Point = { tick: string; full: string; volume: number };

/** Round a maximum up to 1, 2, 2.5 or 5 of its power of ten, for clean gridlines. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v));
  const f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

const short = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

/** Which bars get an axis label: every day for a week, about five otherwise. */
function labelled(count: number, i: number): boolean {
  if (count <= 7) return true;
  const step = count <= 30 ? 7 : 13;
  return (count - 1 - i) % step === 0;
}

/**
 * Volume over time as bars (days are discrete; a smoothed line invented dips
 * between sessions), with a rolling-window selector. Buckets by day for the
 * 7- and 30-day windows and by ISO week for the year, zero-filling empty
 * days/weeks so the axis stays continuous. All buckets come from the full
 * daily series, so switching ranges is instant.
 *
 * Plain HTML bars, not a chart library: this card is on the home screen, and
 * Recharts was 100 KB of script to parse there for one bar chart. Touching or
 * hovering a bar reads its value into the subtitle.
 *
 * `today` is the lifter's local date from the server, never `new Date()` at
 * render, which would disagree with the server around midnight.
 */
export function VolumeTrendCard({
  daily,
  unit,
  today,
  className,
}: {
  daily: DayVolume[];
  unit: Unit;
  today: string;
  className?: string;
}) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [active, setActive] = useState<number | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of daily) m.set(d.date, (m.get(d.date) ?? 0) + d.volumeKg);
    return m;
  }, [daily]);

  const points = useMemo<Point[]>(() => {
    const conv = (kg: number) => Math.round(unit === "lb" ? kgToLb(kg) : kg);
    const now = parseISO(today);

    if (range === "1y") {
      const byWeek = new Map<string, number>();
      for (const [date, kg] of byDay) {
        const key = format(startOfISOWeek(parseISO(date)), "yyyy-MM-dd");
        byWeek.set(key, (byWeek.get(key) ?? 0) + kg);
      }
      const start = startOfISOWeek(subWeeks(now, 51));
      return Array.from({ length: 52 }).map((_, i) => {
        const d = addDays(start, i * 7);
        return {
          tick: format(d, "MMM"),
          full: `Week of ${format(d, "d MMM")}`,
          volume: conv(byWeek.get(format(d, "yyyy-MM-dd")) ?? 0),
        };
      });
    }

    const days = range === "7d" ? 7 : 30;
    return Array.from({ length: days }).map((_, i) => {
      const d = subDays(now, days - 1 - i);
      return {
        tick: format(d, days === 7 ? "EEE" : "d MMM"),
        full: format(d, "EEE d MMM"),
        volume: conv(byDay.get(format(d, "yyyy-MM-dd")) ?? 0),
      };
    });
  }, [byDay, range, unit, today]);

  const meta = RANGES.find((r) => r.key === range)!;
  const empty = points.every((p) => p.volume === 0);
  const top = niceMax(Math.max(...points.map((p) => p.volume)));
  const picked = active != null ? points[active] : null;

  return (
    <section className={cn("flex flex-col rounded-2xl bg-surface", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text">Volume</h3>
          <p className="tnum mt-0.5 truncate text-[13px] text-muted" aria-live="polite">
            {picked ? (
              <>
                {picked.full}: <span className="text-text">{picked.volume.toLocaleString()} {unit}</span>
              </>
            ) : (
              meta.sub
            )}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Volume time range"
          className="flex shrink-0 rounded-full bg-white/[0.06] p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              onClick={() => {
                setRange(r.key);
                setActive(null);
              }}
              className={cn(
                "tnum h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                range === r.key ? "bg-white/[0.12] text-text" : "text-muted hover:text-text",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <ChartEmpty message="No volume logged in this window yet." />
      ) : (
        <div className="px-4 pb-4 pt-5">
          <div
            className="relative h-[200px]"
            role="img"
            aria-label={`${meta.sub}. Highest ${Math.max(...points.map((p) => p.volume)).toLocaleString()} ${unit}.`}
          >
            {/* Gridlines at 0, half and the top of the scale */}
            {[1, 0.5, 0].map((f) => (
              <div
                key={f}
                aria-hidden
                className="absolute inset-x-0 flex items-center gap-2"
                style={{ bottom: `${f * 100}%`, transform: "translateY(50%)" }}
              >
                <span className="tnum w-8 shrink-0 text-right text-[11px] text-muted">{short(top * f)}</span>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
            ))}
            <div
              className={cn(
                "absolute inset-y-0 left-10 right-0 flex items-end",
                range === "7d" ? "gap-2.5" : range === "30d" ? "gap-[3px]" : "gap-[2px]",
              )}
              onPointerLeave={() => setActive(null)}
            >
              {points.map((p, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex h-full flex-1 items-end justify-center rounded-md transition-colors duration-150",
                    active === i && "bg-white/[0.04]",
                  )}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                >
                  {p.volume > 0 && (
                    <div
                      className={cn(
                        "w-full transition-opacity duration-150",
                        range === "7d" ? "max-w-7 rounded-md" : "rounded-[3px]",
                        active == null || active === i ? "bg-text/85" : "bg-text/40",
                      )}
                      style={{ height: `max(3px, ${(p.volume / top) * 100}%)` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Axis labels share the bars' columns so each sits under its bar. */}
          <div
            aria-hidden
            className={cn(
              "ml-10 mt-2 flex",
              range === "7d" ? "gap-2.5" : range === "30d" ? "gap-[3px]" : "gap-[2px]",
            )}
          >
            {points.map((p, i) => (
              <div key={i} className="relative h-4 flex-1">
                {labelled(points.length, i) && (
                  <span
                    className={cn(
                      "absolute top-0 whitespace-nowrap text-[11px] text-muted",
                      points.length <= 7
                        ? "left-1/2 -translate-x-1/2"
                        : i === points.length - 1
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {p.tick}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
