import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className joiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact number formatting for volume/weight totals (e.g. 12.4k). */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "k";
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
