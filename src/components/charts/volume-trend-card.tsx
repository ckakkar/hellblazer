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
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kgToLb, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { AXIS_TICK, ChartEmpty, GRID_STROKE, TooltipBox } from "./chart-kit";

/** One calendar day of lifted tonnage, canonical kg. */
export type DayVolume = { date: string; volumeKg: number };

type RangeKey = "7d" | "30d" | "1y";
const RANGES: { key: RangeKey; label: string; sub: string }[] = [
  { key: "7d", label: "7D", sub: "Daily, last 7 days" },
  { key: "30d", label: "30D", sub: "Daily, last 30 days" },
  { key: "1y", label: "1Y", sub: "Weekly, last 52 weeks" },
];

type Point = { label: string; volume: number };

/**
 * Volume over time as bars (days are discrete; a smoothed line invented dips
 * between sessions), with a rolling-window selector. Buckets by day
 * for the 7- and 30-day windows and by ISO week for the year, zero-filling
 * empty days/weeks so the axis stays continuous. All buckets are derived
 * client-side from the full daily series, so switching ranges is instant.
 */
export function VolumeTrendCard({
  daily,
  unit,
  className,
}: {
  daily: DayVolume[];
  unit: Unit;
  className?: string;
}) {
  const [range, setRange] = useState<RangeKey>("7d");

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of daily) m.set(d.date, (m.get(d.date) ?? 0) + d.volumeKg);
    return m;
  }, [daily]);

  const points = useMemo<Point[]>(() => {
    const conv = (kg: number) => Math.round(unit === "lb" ? kgToLb(kg) : kg);
    const today = new Date();

    if (range === "1y") {
      const byWeek = new Map<string, number>();
      for (const [date, kg] of byDay) {
        const key = format(startOfISOWeek(parseISO(date)), "yyyy-MM-dd");
        byWeek.set(key, (byWeek.get(key) ?? 0) + kg);
      }
      const start = startOfISOWeek(subWeeks(today, 51));
      return Array.from({ length: 52 }).map((_, i) => {
        const d = addDays(start, i * 7);
        return {
          label: format(d, "MMM d"),
          volume: conv(byWeek.get(format(d, "yyyy-MM-dd")) ?? 0),
        };
      });
    }

    const days = range === "7d" ? 7 : 30;
    return Array.from({ length: days }).map((_, i) => {
      const d = subDays(today, days - 1 - i);
      return {
        label: format(d, days === 7 ? "EEE" : "MMM d"),
        volume: conv(byDay.get(format(d, "yyyy-MM-dd")) ?? 0),
      };
    });
  }, [byDay, range, unit]);

  const meta = RANGES.find((r) => r.key === range)!;
  const empty = points.every((p) => p.volume === 0);

  return (
    <section className={cn("flex flex-col rounded-2xl bg-surface", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text">Volume</h3>
          <p className="mt-0.5 text-[13px] text-muted">{meta.sub}</p>
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
              onClick={() => setRange(r.key)}
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

      <div className="min-w-0 flex-1 p-2 pt-3">
        {empty ? (
          <ChartEmpty message="No volume logged in this window yet." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                minTickGap={range === "7d" ? 4 : 20}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
              />
              <Tooltip
                cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox label={label}>
                      {Number(payload[0].value).toLocaleString()} {unit}
                    </TooltipBox>
                  ) : null
                }
              />
              <Bar
                dataKey="volume"
                fill="var(--color-text)"
                fillOpacity={0.85}
                radius={[4, 4, 4, 4]}
                maxBarSize={range === "7d" ? 28 : 14}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
