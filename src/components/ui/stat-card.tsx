import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/reactbits/count-up";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
  /**
   * Numeric value to spring up to on first view (React Bits CountUp) instead
   * of rendering `value` statically. Opt-in: only worth it where the number is
   * the headline. Falls back to `value` for anything non-numeric, and the
   * component itself no-ops under prefers-reduced-motion. Decimal places are
   * inferred from the value, so 12.5 counts as "12.5".
   */
  countTo?: number;
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  highlight,
  className,
  countTo,
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
          {countTo !== undefined ? (
            <CountUp to={countTo} duration={1.1} separator="," />
          ) : (
            value
          )}
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
