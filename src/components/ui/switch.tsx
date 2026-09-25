"use client";

import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/**
 * An iOS switch, at the system's size (51×31) and with its detent: in the
 * app, flipping it ticks the Taptic Engine like a real UISwitch.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic("tick");
        onChange(!checked);
      }}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60",
        checked ? "bg-accent" : "bg-white/[0.16]",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-out",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
