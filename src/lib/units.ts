export type Unit = "kg" | "lb";

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/**
 * Canonical storage is always kg. Convert to the user's display unit and round
 * to a sensible gym-plate precision (0.5 increments).
 */
export function toDisplayWeight(kg: number, unit: Unit): number {
  const raw = unit === "lb" ? kgToLb(kg) : kg;
  return Math.round(raw * 2) / 2;
}

/** Convert a value the user typed in their display unit back to canonical kg. */
export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === "lb" ? lbToKg(value) : value;
}

/** Trim trailing ".0" for clean mono display. */
export function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function formatWeight(kg: number, unit: Unit): string {
  return `${trimNum(toDisplayWeight(kg, unit))}${unit}`;
}

/** Volume is a weight-times-reps product; convert the weight component only. */
export function formatVolume(volumeKg: number, unit: Unit): string {
  const converted = unit === "lb" ? kgToLb(volumeKg) : volumeKg;
  if (converted >= 1000) {
    return `${(converted / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k ${unit}`;
  }
  return `${Math.round(converted).toLocaleString()} ${unit}`;
}
