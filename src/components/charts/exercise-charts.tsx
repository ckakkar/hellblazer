"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kgToLb, trimNum, type Unit } from "@/lib/units";
import {
  AXIS_TICK,
  ChartEmpty,
  GRID_STROKE,
  TooltipBox,
  axisWidthFor,
  dateTick,
  fullDate,
} from "./chart-kit";

type Point = { date: string; est1rm: number; volume: number };

function conv(kg: number, unit: Unit) {
  return Math.round((unit === "lb" ? kgToLb(kg) : kg) * 10) / 10;
}

/**
 * A lift's estimated max session by session. The record is marked: the one
 * point on the line in the accent, with its figure, since breaking it is
 * what the line is for.
 */
export function OneRepMaxChart({
  data,
  unit,
  height = 260,
}: {
  data: Point[];
  unit: Unit;
  height?: number;
}) {
  // Keyed by the full date; the axis and tooltip format it (with the year
  // when it matters), so two sessions a year apart stay two points.
  const chartData = data.map((p) => ({
    date: p.date,
    est1rm: conv(p.est1rm, unit),
  }));
  const recordAt = chartData.reduce((best, d, i) => (d.est1rm > chartData[best].est1rm ? i : best), 0);
  const record = chartData[recordAt] ?? null;
  // Its figure sits above the dot, or to its left near the right edge, where
  // above would run off the chart. Rounded as the page's figures are.
  const recordLabel = record ? `${trimNum(Math.round(record.est1rm * 2) / 2)} ${unit}` : "";
  const nearEnd = recordAt > (chartData.length - 1) * 0.8;
  if (chartData.length === 0)
    return <ChartEmpty message="No working sets logged for this exercise yet." />;

  // Same clipping trap as the bodyweight chart: a fixed axis pulled left by a
  // negative margin cuts the leading digit off long lb figures.
  const yWidth = axisWidthFor(chartData.map((d) => d.est1rm));
  const first = chartData[0];
  const last = chartData[chartData.length - 1];

  return (
    <>
    {/* The chart in words, for a screen reader: where it started, where it is, the record. */}
    <p className="sr-only">
      Estimated max over {chartData.length} {chartData.length === 1 ? "session" : "sessions"}: {trimNum(first.est1rm)} {unit} on{" "}
      {fullDate(first.date)}, {trimNum(last.est1rm)} {unit} on {fullDate(last.date)}
      {record ? `, best ${recordLabel} on ${fullDate(record.date)}` : ""}.
    </p>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 28, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="oneRmFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-text)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--color-text)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={16}
          tickFormatter={dateTick(chartData.map((d) => d.date))}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={yWidth}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox label={typeof label === "string" ? fullDate(label) : label}>
                {payload[0].value} {unit} est. 1RM
              </TooltipBox>
            ) : null
          }
        />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="est1rm"
          stroke="var(--color-text)"
          strokeWidth={2}
          fill="url(#oneRmFill)"
          dot={{ r: 2.5, fill: "var(--color-text)", strokeWidth: 0 }}
          activeDot={{ r: 4.5, fill: "var(--color-text)", stroke: "var(--color-bg)", strokeWidth: 2 }}
        />
        {record && chartData.length > 1 && (
          <ReferenceDot
            x={record.date}
            y={record.est1rm}
            r={5.5}
            fill="rgb(var(--accent-rgb))"
            stroke="var(--color-bg)"
            strokeWidth={2.5}
            ifOverflow="visible"
            label={{
              value: recordLabel,
              position: nearEnd ? "left" : "top",
              offset: nearEnd ? 12 : 10,
              fill: "var(--color-text)",
              fontSize: 12,
              fontWeight: 600,
            }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
    </>
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
    date: p.date,
    volume: Math.round(unit === "lb" ? kgToLb(p.volume) : p.volume),
  }));
  if (chartData.length === 0)
    return <ChartEmpty message="No volume logged for this exercise yet." />;

  const volTick = (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`);
  const yWidth = axisWidthFor(chartData.map((d) => d.volume), volTick);
  const heaviest = chartData.reduce((a, b) => (b.volume > a.volume ? b : a));

  return (
    <>
    <p className="sr-only">
      Volume over {chartData.length} {chartData.length === 1 ? "session" : "sessions"}, the most{" "}
      {heaviest.volume.toLocaleString()} {unit} on {fullDate(heaviest.date)}, the latest{" "}
      {chartData[chartData.length - 1].volume.toLocaleString()} {unit} on {fullDate(chartData[chartData.length - 1].date)}.
    </p>
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={16}
          tickFormatter={dateTick(chartData.map((d) => d.date))}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={yWidth}
          tickFormatter={volTick}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklab, var(--color-text) 5%, transparent)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox label={typeof label === "string" ? fullDate(label) : label}>
                {Number(payload[0].value).toLocaleString()} {unit} volume
              </TooltipBox>
            ) : null
          }
        />
        <Bar
          isAnimationActive={false}
          dataKey="volume"
          radius={[3, 3, 0, 0]}
          fill="var(--color-chart-2)"
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
    </>
  );
}
