import * as React from "react";
import { cn } from "@/lib/utils";

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
    <section className={cn("flex flex-col rounded-2xl bg-surface", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1 p-2 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}
