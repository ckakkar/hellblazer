"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn, fitFigure, selectAllOnFocus } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface NumberStepperProps {
  value: number | null;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Decimal places to keep; avoids float drift on e.g. 2.5 steps. */
  precision?: number;
  placeholder?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Big-tap-target numeric control for mid-workout logging: increment buttons
 * flank a directly-editable numeric field. Optimised for one-handed mobile use.
 *
 * Two to a row on a 320pt phone leaves each about 128px, so a narrow one
 * gives its buttons less width (never less height), and the figure shrinks
 * to fit ("132.5" as well as "80") but never under 16px, where iOS would
 * zoom in on the field when it's tapped.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100000,
  precision = 2,
  placeholder = "0",
  suffix,
  className,
  ariaLabel,
}: NumberStepperProps) {
  const round = (n: number) => {
    const f = 10 ** precision;
    return Math.round(n * f) / f;
  };
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  // Each step ticks like a picker's detent in the iOS app, so the weight can
  // be dialled in without looking.
  const bump = (dir: 1 | -1) => {
    haptic("tick");
    onChange(clamp(round((value ?? 0) + dir * step)));
  };

  const figure = fitFigure(value == null || Number.isNaN(value) ? placeholder : String(value), "22px", suffix ? "2rem" : "0px");
  const button =
    "flex w-12 shrink-0 items-center justify-center text-muted transition-colors hover:text-text active:bg-white/[0.06] @max-[11rem]:w-9";

  return (
    <div
      className={cn(
        "@container flex h-14 items-stretch overflow-hidden rounded-2xl bg-surface-2",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? ""}`}
        onClick={() => bump(-1)}
        className={button}
      >
        <Minus className="size-4" />
      </button>
      <div className="@container relative flex min-w-0 flex-1 items-center">
        <input
          inputMode="decimal"
          type="number"
          data-display
          aria-label={ariaLabel}
          value={value ?? ""}
          placeholder={placeholder}
          onFocus={selectAllOnFocus}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return onChange(NaN);
            const n = Number(v);
            if (!Number.isNaN(n)) onChange(n);
          }}
          style={{
            ...figure,
            fontSize: "max(16px, min(var(--fit-max), calc((100cqw - var(--fit-reserve)) / var(--fit-em))))",
          }}
          className="font-display h-full w-full min-w-0 bg-transparent text-center text-text focus:outline-none"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 text-[13px] text-muted">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`increase ${ariaLabel ?? ""}`}
        onClick={() => bump(1)}
        className={button}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
