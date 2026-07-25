"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "flex h-12 items-stretch overflow-hidden rounded-lg border border-border bg-surface-2 shadow-inset",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? ""}`}
        onClick={() => bump(-1)}
        className="flex w-11 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface hover:text-accent active:bg-bg"
      >
        <Minus className="size-4" />
      </button>
      <div className="relative flex min-w-0 flex-1 items-center">
        <input
          inputMode="decimal"
          type="number"
          aria-label={ariaLabel}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return onChange(NaN);
            const n = Number(v);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="h-full w-full min-w-0 bg-transparent text-center font-mono text-lg tabular-nums text-text focus:outline-none"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`increase ${ariaLabel ?? ""}`}
        onClick={() => bump(1)}
        className="flex w-11 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface hover:text-accent active:bg-bg"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
