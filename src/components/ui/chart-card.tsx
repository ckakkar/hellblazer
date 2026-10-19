import * as React from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

/**
 * A chart on the page, not in a box: a rule above it, the title on the
 * canvas, and the plot on the same ground as everything else. Boxes are kept
 * for things you operate (lists, controls); a chart is read.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  headerClassName,
  bodyClassName,
}: ChartCardProps) {
  return (
    <section className={cn("flex flex-col border-t border-text/[0.12]", className)}>
      <div className={cn("flex items-start justify-between gap-3 px-1 pt-4", headerClassName)}>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1 pb-2 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}
