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

/**
 * Widths in ems of the display face's odd glyphs (Archivo expanded, with its
 * tracking), measured. Everything else falls back by class in glyphEm.
 */
const GLYPH_EM: Record<string, number> = {
  f: 0.39, i: 0.25, j: 0.25, l: 0.25, r: 0.41, t: 0.42, m: 1.1, w: 0.95,
  I: 0.32, J: 0.67, L: 0.69, F: 0.76, T: 0.78, M: 1.08, W: 1.16,
  G: 0.98, O: 0.98, Q: 0.98, "-": 0.38, "(": 0.32, ")": 0.32,
};

function glyphEm(ch: string): number {
  if (ch in GLYPH_EM) return GLYPH_EM[ch];
  if (/[\s.,:;/'’]/.test(ch)) return 0.28;
  if (/[A-Z&]/.test(ch)) return 0.92;
  // Digits, the rest of the lowercase, and anything unforeseen.
  return 0.72;
}

/** Text's width in ems in the display face, about. */
export function displayEm(text: string): number {
  let em = 0;
  for (const ch of text) em += glyphEm(ch);
  return em;
}

/**
 * Style for text in the display face that shrinks to fit its column instead
 * of spilling out of it (the `.hb-fit` utility): a stat strip's five-figure
 * volume, a fighter's name, on a 320pt phone. Full size (`max`) whenever it
 * fits. Given several pieces (the words of a name that wraps), it fits the
 * widest. The column must be an inline-size container (`@container`);
 * `reserve` is room kept beside the text, for a unit.
 */
export function fitFigure(
  text: string | string[],
  max: string,
  reserve = "0px",
): React.CSSProperties {
  const em = Math.max(...[text].flat().map(displayEm));
  return {
    // A little over, so rounding never tips it past the edge.
    "--fit-em": Math.max(em * 1.02, 1).toFixed(3),
    "--fit-max": max,
    "--fit-reserve": reserve,
  } as React.CSSProperties;
}
