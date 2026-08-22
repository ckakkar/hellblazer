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
import { toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import { AXIS_TICK, GRID_STROKE, TooltipBox, axisWidthFor } from "./chart-kit";

type Log = { date: string; weight_kg: number };

/** Bodyweight over time: a tight-domain area so small changes are visible. */
export function BodyweightChart({ logs, unit }: { logs: Log[]; unit: Unit }) {
  const data = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({
      date: format(parseISO(l.date), "MMM d"),
      weight: Math.round(toDisplayWeight(l.weight_kg, unit) * 10) / 10,
    }));

  if (data.length < 2) return null; // need at least two points to draw a trend

  // The gutter is sized to the widest tick it has to hold. A fixed 40px axis
  // pulled 8px further left by a negative margin clipped the leading digit off
  // lb bodyweights, which run to four digits and a decimal ("230.5").
  const yWidth = axisWidthFor(
    data.map((d) => d.weight),
    (v) => trimNum(v),
  );

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="bwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={20}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={yWidth}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v) => `${trimNum(Number(v))}`}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox label={label}>
                {payload[0].value} {unit}
              </TooltipBox>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="weight"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="url(#bwFill)"
          dot={{ r: 2, fill: "var(--color-accent)", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-bg)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
