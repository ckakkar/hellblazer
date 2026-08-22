import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Grouped settings list ─────────────────────────────────────────────────
   The profile screen used to be eight standalone Cards, each with its own
   heading and a paragraph of prose, which is what made it read as a document
   rather than an app. This is the grouped-table pattern instead: one container
   per *group*, hairline-divided rows inside it, and a caption only where the
   group genuinely needs explaining.

   A row states its name on the left and puts the control or the current value
   on the right, so the column of values can be scanned without reading any of
   the labels. */

export function SettingsGroup({
  label,
  caption,
  children,
  className,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="px-1 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        {label}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {children}
      </div>
      {caption && (
        <p className="px-1 pt-2 text-[12px] leading-5 text-muted">{caption}</p>
      )}
    </section>
  );
}

/**
 * One row. Give it a `control` for an inline widget, an `href` to make the
 * whole row a link, or `children` for a control that needs the full width
 * underneath the label.
 */
export function SettingsRow({
  label,
  hint,
  control,
  href,
  danger,
  children,
}: {
  label: string;
  hint?: string;
  control?: React.ReactNode;
  href?: string;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const head = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] leading-tight",
            danger ? "text-danger" : "text-text",
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12px] leading-5 text-muted">
            {hint}
          </span>
        )}
      </span>
      {control && <span className="shrink-0">{control}</span>}
      {href && <ChevronRight className="size-4 shrink-0 text-muted" />}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
      >
        {head}
      </Link>
    );
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">{head}</div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** A row whose content is a value read-out rather than a control. */
export function SettingsValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[13px] tabular-nums text-muted">
      {children}
    </span>
  );
}
