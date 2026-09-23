"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn, selectAllOnFocus } from "@/lib/utils";

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

  const bump = (dir: 1 | -1) => onChange(clamp(round((value ?? 0) + dir * step)));

  return (
    <div
      className={cn(
        "flex h-14 items-stretch overflow-hidden rounded-2xl bg-surface-2",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? ""}`}
        onClick={() => bump(-1)}
        className="flex w-12 shrink-0 items-center justify-center text-muted transition-colors hover:text-text active:bg-white/[0.06]"
      >
        <Minus className="size-4" />
      </button>
      <div className="relative flex min-w-0 flex-1 items-center">
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
          className="font-display h-full w-full min-w-0 bg-transparent text-center text-[22px] text-text focus:outline-none"
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
        className="flex w-12 shrink-0 items-center justify-center text-muted transition-colors hover:text-text active:bg-white/[0.06]"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
