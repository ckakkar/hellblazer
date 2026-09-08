import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow = "Official record",
  index,
  stat,
  className,
}: {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
  index?: string;
  stat?: { value: React.ReactNode; label: string };
  className?: string;
}) {
  return (
    <header
      className={cn(
        "hb-page-head relative mb-8 isolate overflow-hidden border-y-2 border-text/80 px-4 py-5 sm:px-6 sm:py-7",
        className,
      )}
    >
      {index && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-7 -z-10 font-impact text-[8.5rem] leading-none text-text/[0.035] sm:right-5 sm:text-[11rem]"
        >
          {index}
        </span>
      )}
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.28em] text-accent">
            <span className="h-px w-8 bg-accent" />
            {eyebrow}
            {index && <span className="text-muted/60">file {index}</span>}
          </div>
          <h1 className="font-impact text-[3.15rem] uppercase leading-[0.78] tracking-[-0.02em] text-text sm:text-[4.75rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-xl text-sm leading-6 text-text/65 sm:text-[15px]">
              {subtitle}
            </p>
          )}
        </div>
        {(stat || action) && (
          <div className="flex shrink-0 flex-wrap items-end gap-4 sm:flex-col sm:items-end">
            {stat && (
              <div className="min-w-24 border-l border-border pl-4 sm:border-l-0 sm:border-r sm:pl-0 sm:pr-4 sm:text-right">
                <div className="font-impact text-3xl leading-none tabular-nums text-text">
                  {stat.value}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                  {stat.label}
                </div>
              </div>
            )}
            {action}
          </div>
        )}
      </div>
    </header>
  );
}

/** Mono uppercase micro-label for section headers, the instrument-panel eyebrow. */
export function SectionLabel({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-center justify-between gap-2 px-1",
        className,
      )}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        {children}
      </span>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="hb-panel-cut relative flex min-h-56 flex-col items-start justify-end overflow-hidden border border-dashed border-border bg-surface/50 px-6 py-7 text-left">
      <span aria-hidden className="absolute -right-3 -top-8 font-impact text-[9rem] leading-none text-text/[0.025]">00</span>
      {icon && <div className="mb-5 flex size-10 items-center justify-center border border-border bg-bg text-accent">{icon}</div>}
      <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted">No record found</div>
      <h3 className="mt-2 font-display text-lg uppercase tracking-wide text-text">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm leading-6 text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
