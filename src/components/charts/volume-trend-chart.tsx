"use client";

import { format, parseISO } from "date-fns";
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
import { AXIS_TICK, ChartEmpty, GRID_STROKE, TooltipBox } from "./chart-kit";

type Point = { week: string; volume: number };

export function VolumeTrendChart({
  data,
  unit,
}: {
  data: Point[];
  unit: Unit;
}) {
  const chartData = data.map((p) => ({
    week: format(parseISO(p.week), "MMM d"),
    volume: Math.round(unit === "lb" ? kgToLb(p.volume) : p.volume),
  }));

  if (chartData.every((d) => d.volume === 0)) {
    return <ChartEmpty message="No volume logged yet in this window." />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 10, bottom: 4, left: -6 }}>
        <defs>
          <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="week"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={16}
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
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-bg)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
