/** Selectable accent hues, named after Kengan Association member companies.
 *  Keys must match the html[data-accent] blocks in globals.css; `swatch` is
 *  only for rendering the picker preview. */
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
  { key: "crimson", name: "Nogi", swatch: "#ff2d3a" },
  { key: "ember", name: "Motorhead", swatch: "#ff7a29" },
  { key: "gold", name: "Dainippon", swatch: "#f5b028" },
  { key: "green", name: "Kouou", swatch: "#74bfa0" },
  { key: "slate", name: "Under Mount", swatch: "#96a2b4" },
  { key: "violet", name: "Gandai", swatch: "#a86cff" },
];

export const ACCENT_KEYS = ACCENTS.map((a) => a.key);
export const DEFAULT_ACCENT: AccentKey = "crimson";

export function isAccentKey(v: string | undefined | null): v is AccentKey {
  return !!v && (ACCENT_KEYS as string[]).includes(v);
}
