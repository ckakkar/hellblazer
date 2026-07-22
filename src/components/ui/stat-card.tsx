import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  highlight,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "p-4",
        highlight && "border-accent/30 bg-accent/[0.04]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
          {label}
        </span>
        {icon && (
          <span className={highlight ? "text-accent" : "text-muted"}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span
          className={cn(
            "font-impact text-[1.9rem] leading-none tabular-nums",
            highlight ? "text-accent" : "text-text",
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs uppercase tracking-wide text-muted">
            {unit}
          </span>
        )}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-muted">{hint}</div>}
    </Card>
  );
}
