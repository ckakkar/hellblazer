"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MUSCLE_LABEL, isWeakPoint, type Muscle } from "@/lib/muscles";
import { AXIS_TICK, ChartEmpty, TooltipBox } from "./chart-kit";

type Row = { muscle: Muscle; sets: number };
type Datum = { label: string; sets: number; weak: boolean };

export function WeeklySetsChart({ data }: { data: Row[] }) {
  const chartData: Datum[] = data.map((d) => ({
    label: MUSCLE_LABEL[d.muscle],
    sets: Math.round(d.sets * 10) / 10,
    weak: isWeakPoint(d.muscle),
  }));

  const total = chartData.reduce((s, d) => s + d.sets, 0);
  if (total === 0) {
    return <ChartEmpty message="No sets logged this week yet. Start a session to populate this." />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
        <XAxis
          dataKey="label"
          tick={{ ...AXIS_TICK, fontSize: 10 }}
          interval={0}
          angle={-42}
          textAnchor="end"
          height={62}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox label={label}>
                {payload[0].value} sets
                {(payload[0].payload as Datum).weak ? (
                  <span className="ml-1 text-accent">· weak point</span>
                ) : null}
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="sets" radius={[3, 3, 0, 0]} maxBarSize={36}>
          {chartData.map((d, i) => (
            <Cell
              key={i}
              fill={d.weak ? "var(--color-accent)" : "var(--color-surface-2)"}
              stroke={d.weak ? "transparent" : "var(--color-border)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
