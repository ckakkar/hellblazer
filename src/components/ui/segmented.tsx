"use client";

import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode; ariaLabel?: string };

/**
 * An iOS segmented control: the segments share one width (the widest
 * label's), so the selection is a single thumb that glides to the segment
 * chosen, by transform alone. `value` null shows no thumb (an optional
 * choice nobody's made). Tabs (`kind="tabs"`) for switching a view, radios
 * for picking a value. In the app, a change ticks like a picker's detent.
 * The keyboard works as either role promises: one tab stop (the segment
 * chosen), and the arrow keys, Home and End move the choice along it.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  kind = "radio",
  label,
  size = "md",
  className,
  disabled,
}: {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  kind?: "radio" | "tabs";
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const index = options.findIndex((o) => o.value === value);
  const tabs = kind === "tabs";
  const choose = (i: number, from: HTMLElement) => {
    const o = options[(i + options.length) % options.length];
    if (o.value !== value) haptic("tick");
    onChange(o.value);
    const buttons = from.parentElement?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[(i + options.length) % options.length]?.focus();
  };
  return (
    <div
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={label}
      className={cn(
        "relative isolate inline-grid auto-cols-fr grid-flow-col rounded-full bg-text/[0.06] p-0.5",
        className,
      )}
      style={{ "--seg-n": options.length } as React.CSSProperties}
    >
      <span
        aria-hidden
        className={cn(
          "hb-seg-thumb absolute inset-y-0.5 left-0.5 -z-10 rounded-full bg-text/[0.12]",
          index < 0 && "opacity-0",
        )}
        style={{ transform: `translateX(${Math.max(0, index) * 100}%)` }}
      />
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? "tab" : "radio"}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            aria-label={o.ariaLabel}
            disabled={disabled}
            tabIndex={on || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => {
              if (!on) haptic("tick");
              onChange(o.value);
            }}
            onKeyDown={(e) => {
              const step =
                e.key === "ArrowRight" || e.key === "ArrowDown"
                  ? 1
                  : e.key === "ArrowLeft" || e.key === "ArrowUp"
                    ? -1
                    : 0;
              if (step) choose(i + step, e.currentTarget);
              else if (e.key === "Home") choose(0, e.currentTarget);
              else if (e.key === "End") choose(options.length - 1, e.currentTarget);
              else return;
              e.preventDefault();
            }}
            className={cn(
              "hb-hit min-w-0 truncate rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text/40 disabled:opacity-50",
              size === "sm" && "h-7 px-2.5 text-[12px]",
              size === "md" && "h-8 px-4 text-[13px]",
              size === "lg" && "h-9 px-3 text-[14px]",
              on ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
