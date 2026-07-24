"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Destructive icon button with a two-tap safety. The first tap arms it (icon
 * turns danger, a ring appears); a second tap within ~3s confirms. It auto-
 * disarms on timeout or blur so a stray arm never lingers, and keeps a fixed
 * footprint (no layout shift) so it drops into tight action rows on mobile.
 */
export function ConfirmIconButton({
  onConfirm,
  label,
  confirmLabel = "Tap again to confirm",
  icon: Icon = Trash2,
  disabled = false,
  className,
}: {
  onConfirm: () => void;
  label: string;
  confirmLabel?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
  }

  function handle() {
    if (disabled) return;
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    disarm();
    onConfirm();
  }

  return (
    <button
      type="button"
      aria-label={armed ? confirmLabel : label}
      title={armed ? confirmLabel : label}
      disabled={disabled}
      onClick={handle}
      onBlur={disarm}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-45",
        armed
          ? "bg-danger/15 text-danger ring-1 ring-danger/50"
          : "text-muted hover:text-danger",
        className,
      )}
    >
      <Icon className={cn("size-4 transition-transform", armed && "scale-110")} />
    </button>
  );
}
