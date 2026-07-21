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
      <div className="flex items-start justify-between gap-3 p-5 pb-2">
        <div>
          <h3 className="text-sm font-medium tracking-tight text-text">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1 p-2 pt-1", bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}
