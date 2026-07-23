"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { formatVolume, type Unit } from "@/lib/units";
import { ChartEmpty, TooltipBox } from "./chart-kit";

type Row = { muscle: Muscle; volume: number };
type Slice = { label: string; volume: number; other?: boolean };

/** Where your tonnage goes — volume share across muscles, as a crimson-ramp donut. */
export function MuscleVolumeDonut({ data, unit }: { data: Row[]; unit: Unit }) {
  const ranked = data
    .filter((d) => d.volume > 0)
    .sort((a, b) => b.volume - a.volume);

  if (ranked.length === 0) {
    return <ChartEmpty message="No volume logged in this window yet." />;
  }

  const total = ranked.reduce((s, d) => s + d.volume, 0);
  const top = ranked.slice(0, 8).map<Slice>((d) => ({
    label: MUSCLE_LABEL[d.muscle],
    volume: d.volume,
  }));
  const restVol = ranked.slice(8).reduce((s, d) => s + d.volume, 0);
  const slices: Slice[] = restVol > 0 ? [...top, { label: "Other", volume: restVol, other: true }] : top;

  const color = (i: number, other?: boolean) => {
    if (other) return "var(--color-surface-2)";
    const alpha = Math.max(0.28, 1 - (i / Math.max(1, slices.length)) * 0.8);
    return `rgba(255,45,58,${alpha.toFixed(2)})`;
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="volume"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={100}
              paddingAngle={2}
              stroke="var(--color-bg)"
              strokeWidth={2}
            >
              {slices.map((s, i) => (
                <Cell key={i} fill={color(i, s.other)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox label={(payload[0].payload as Slice).label}>
                    {formatVolume(Number(payload[0].value), unit)} ·{" "}
                    {Math.round((Number(payload[0].value) / total) * 100)}%
                  </TooltipBox>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
            Total
          </span>
          <span className="font-impact text-xl leading-none text-text">
            {formatVolume(total, unit)}
          </span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-1">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: color(i, s.other) }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{s.label}</span>
            <span className="shrink-0 font-mono tabular-nums text-text">
              {Math.round((s.volume / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
