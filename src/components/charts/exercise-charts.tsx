"use client";

import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kgToLb, type Unit } from "@/lib/units";
import { AXIS_TICK, ChartEmpty, GRID_STROKE, TooltipBox } from "./chart-kit";

type Point = { date: string; est1rm: number; volume: number };

function conv(kg: number, unit: Unit) {
  return Math.round((unit === "lb" ? kgToLb(kg) : kg) * 10) / 10;
}

export function OneRepMaxChart({
  data,
  unit,
}: {
  data: Point[];
  unit: Unit;
}) {
  const chartData = data.map((p) => ({
    date: format(parseISO(p.date), "MMM d"),
    est1rm: conv(p.est1rm, unit),
  }));
  if (chartData.length === 0)
    return <ChartEmpty message="No working sets logged for this exercise yet." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox label={label}>
                {payload[0].value} {unit} est. 1RM
              </TooltipBox>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="est1rm"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--color-accent)", strokeWidth: 0 }}
          activeDot={{ r: 4.5, fill: "var(--color-accent)", stroke: "var(--color-bg)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VolumeBarsChart({
  data,
  unit,
}: {
  data: Point[];
  unit: Unit;
}) {
  const chartData = data.map((p) => ({
    date: format(parseISO(p.date), "MMM d"),
    volume: Math.round(unit === "lb" ? kgToLb(p.volume) : p.volume),
  }));
  if (chartData.length === 0)
    return <ChartEmpty message="No volume logged for this exercise yet." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox label={label}>
                {Number(payload[0].value).toLocaleString()} {unit} volume
              </TooltipBox>
            ) : null
          }
        />
        <Bar
          dataKey="volume"
          radius={[3, 3, 0, 0]}
          fill="var(--color-chart-2)"
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
