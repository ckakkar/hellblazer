import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A large title, iOS-style: the page names itself in the expanded cut and gets
 * out of the way. `stat` sits beside it as a quiet read-out; `action` is the
 * page's one primary control.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  stat,
  className,
}: {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  stat?: { value: React.ReactNode; label: string };
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-[2.125rem] leading-[1.05] text-text sm:text-[2.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {(stat || action) && (
        <div className="flex shrink-0 items-center gap-4">
          {stat && (
            <p className="text-[13px] text-muted">
              <span className="font-display mr-1.5 text-[17px] text-text">
                {stat.value}
              </span>
              {stat.label}
            </p>
          )}
          {action}
        </div>
      )}
    </header>
  );
}

/** Section heading on the canvas, with an optional trailing action. */
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
      className={cn("mb-3 flex items-baseline justify-between gap-3 px-1", className)}
    >
      <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-text">
        {children}
      </h2>
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
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-surface px-6 py-10 text-center">
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-text">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
