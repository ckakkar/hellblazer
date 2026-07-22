import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs text-muted/80">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1 p-2 pt-3", bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}
