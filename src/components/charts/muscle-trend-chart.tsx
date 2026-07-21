"use client";

import { format, parseISO } from "date-fns";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kgToLb, type Unit } from "@/lib/units";
import { AXIS_TICK, ChartEmpty, GRID_STROKE, TooltipBox } from "./chart-kit";

export type MuscleWeekPoint = { week: string; sets: number; volume: number };

/**
 * Combined weekly view for one muscle: sets as bars (left axis) with a
 * volume-per-muscle-over-time line (right axis). Secondary-muscle weighting is
 * already baked into both values by the aggregation view.
 */
export function MuscleTrendChart({
  data,
  unit,
  accent = true,
}: {
  data: MuscleWeekPoint[];
  unit: Unit;
  accent?: boolean;
}) {
  const chartData = data.map((p) => ({
    week: format(parseISO(p.week), "MMM d"),
    sets: Math.round(p.sets * 10) / 10,
    volume: Math.round(unit === "lb" ? kgToLb(p.volume) : p.volume),
  }));

  if (chartData.every((d) => d.sets === 0)) {
    return <ChartEmpty message="No sets logged for this muscle in this window." />;
  }

  const barColor = accent ? "var(--color-accent)" : "var(--color-surface-2)";

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: -12 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="week"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={16}
        />
        <YAxis
          yAxisId="sets"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="vol"
          orientation="right"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { sets: number; volume: number };
            return (
              <TooltipBox label={label}>
                <div>{row.sets} sets</div>
                <div className="text-muted">
                  {row.volume.toLocaleString()} {unit} vol
                </div>
              </TooltipBox>
            );
          }}
        />
        <Bar
          yAxisId="sets"
          dataKey="sets"
          radius={[3, 3, 0, 0]}
          fill={barColor}
          stroke={accent ? "transparent" : "var(--color-border)"}
          maxBarSize={30}
        />
        <Line
          yAxisId="vol"
          type="monotone"
          dataKey="volume"
          stroke="var(--color-chart-3)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
