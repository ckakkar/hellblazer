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
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            highlight ? "text-accent" : "text-text",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
