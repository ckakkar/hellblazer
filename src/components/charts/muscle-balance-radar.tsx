"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_HIDDEN_MUSCLES, MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { ChartEmpty, TooltipBox } from "./chart-kit";

type Row = { muscle: Muscle; sets: number };

/** Radar of average weekly sets per muscle — see your push/pull/legs balance at a glance. */
export function MuscleBalanceRadar({ data }: { data: Row[] }) {
  const chartData = data
    .filter((d) => !CHART_HIDDEN_MUSCLES.has(d.muscle))
    .map((d) => ({
      label: MUSCLE_LABEL[d.muscle],
      sets: d.sets,
    }));

  if (chartData.every((d) => d.sets === 0)) {
    return <ChartEmpty message="Log a few sessions and your muscle balance appears here." />;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={chartData} outerRadius="72%" margin={{ top: 8, bottom: 8 }}>
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fill: "var(--color-muted)", fontSize: 10 }}
        />
        <Radar
          dataKey="sets"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="var(--color-accent)"
          fillOpacity={0.3}
          dot={{ r: 2, fill: "var(--color-accent)", strokeWidth: 0 }}
        />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox label={(payload[0].payload as { label: string }).label}>
                {payload[0].value} sets / wk
              </TooltipBox>
            ) : null
          }
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
