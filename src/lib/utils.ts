import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className joiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Focus handler that highlights the whole value, so typing overwrites it
 * instead of appending. For mid-workout numeric fields: tapping "60" and
 * typing "65" should give 65, not 6065 or a backspace hunt.
 *
 * Deferred a frame on purpose. Touch browsers place the caret from the tap
 * point *after* the focus event, which undoes a synchronous select(). Uses
 * select() rather than setSelectionRange, which throws on type="number".
 */
export function selectAllOnFocus(
  e: React.FocusEvent<HTMLInputElement>,
): void {
  const el = e.currentTarget;
  requestAnimationFrame(() => {
    // Bail if focus moved on (or the field unmounted) in the meantime.
    if (document.activeElement !== el) return;
    el.select();
  });
}
