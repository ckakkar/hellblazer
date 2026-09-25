/** Selectable accent hues, named after Kengan Association member companies.
 *  Keys must match the html[data-accent] blocks in globals.css, and `swatch`
 *  must be the same colour as that block's --accent-rgb: the Settings picker
 *  previews with it and the share card paints with it. */
export type AccentKey =
  | "crimson"
  | "ember"
  | "gold"
  | "green"
  | "slate"
  | "violet";

export type Accent = {
  key: AccentKey;
  name: string;
  swatch: string;
};

export const ACCENTS: Accent[] = [
  { key: "crimson", name: "Nogi", swatch: "#df2d28" },
  { key: "ember", name: "Motorhead", swatch: "#e86c26" },
  { key: "gold", name: "Dainippon", swatch: "#e2a02c" },
  { key: "green", name: "Kouou", swatch: "#74bfa0" },
  { key: "slate", name: "Under Mount", swatch: "#96a2b4" },
  { key: "violet", name: "Gandai", swatch: "#a86cff" },
];

export const ACCENT_KEYS = ACCENTS.map((a) => a.key);
export const DEFAULT_ACCENT: AccentKey = "crimson";

export function isAccentKey(v: string | undefined | null): v is AccentKey {
  return !!v && (ACCENT_KEYS as string[]).includes(v);
}

/** The accent's hex, for places that can't read the CSS (the Apple Watch). */
export function accentSwatch(key: AccentKey): string {
  return (ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]).swatch;
}
