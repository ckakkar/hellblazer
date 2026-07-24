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
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kgToLb, type Unit } from "@/lib/units";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { AXIS_TICK, ChartEmpty, GRID_STROKE, TooltipBox } from "./chart-kit";

/** One calendar day of lifted tonnage, canonical kg. */
export type DayVolume = { date: string; volumeKg: number };

type RangeKey = "7d" | "30d" | "1y";
const RANGES: { key: RangeKey; label: string; sub: string }[] = [
  { key: "7d", label: "Last 7 days", sub: "Daily tonnage · last 7 days" },
  { key: "30d", label: "Last 30 days", sub: "Daily tonnage · last 30 days" },
  { key: "1y", label: "Last year", sub: "Weekly tonnage · last 52 weeks" },
];

type Point = { label: string; volume: number };

/**
 * Volume-over-time area chart with a rolling-window selector. Buckets by day
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
  const showDots = points.length <= 31;

  return (
    <Card className={["flex flex-col", className].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
        <div className="min-w-0">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Volume trend
          </h3>
          <p className="mt-1 text-xs text-muted/80">{meta.sub}</p>
        </div>
        <Select
          aria-label="Volume time range"
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          className="h-9 w-auto min-w-[124px] shrink-0 text-xs sm:text-xs"
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-0 flex-1 p-2 pt-3">
        {empty ? (
          <ChartEmpty message="No volume logged in this window yet." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={points}
              margin={{ top: 8, right: 10, bottom: 4, left: -6 }}
            >
              <defs>
                <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
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
                cursor={{ stroke: "var(--color-border)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox label={label}>
                      {Number(payload[0].value).toLocaleString()} {unit} volume
                    </TooltipBox>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#volFill)"
                dot={
                  showDots
                    ? { r: 2.5, fill: "var(--color-accent)", strokeWidth: 0 }
                    : false
                }
                activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-bg)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
