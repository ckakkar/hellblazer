/** Selectable accent hues. Keys must match the html[data-accent] blocks in
 *  globals.css; `swatch` is only for rendering the picker preview. */
export type AccentKey =
  | "crimson"
  | "ember"
  | "gold"
  | "teal"
  | "azure"
  | "violet";

export type Accent = {
  key: AccentKey;
  name: string;
  swatch: string;
};

export const ACCENTS: Accent[] = [
  { key: "crimson", name: "Crimson", swatch: "#ff2d3a" },
  { key: "ember", name: "Ember", swatch: "#ff7a29" },
  { key: "gold", name: "Gold", swatch: "#f5b028" },
  { key: "teal", name: "Teal", swatch: "#00e5c7" },
  { key: "azure", name: "Azure", swatch: "#3d8bff" },
  { key: "violet", name: "Violet", swatch: "#a86cff" },
];

export const ACCENT_KEYS = ACCENTS.map((a) => a.key);
export const DEFAULT_ACCENT: AccentKey = "crimson";

export function isAccentKey(v: string | undefined | null): v is AccentKey {
  return !!v && (ACCENT_KEYS as string[]).includes(v);
}
