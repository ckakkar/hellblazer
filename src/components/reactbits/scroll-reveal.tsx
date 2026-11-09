import type { MotionTextProps } from "./scroll-text-types";

/**
 * React Bits' ScrollReveal, on a CSS view timeline: the words light up one
 * after another, from `dim` to full, as the block crosses the screen.
 * STUB: renders the text; the partner builds the motion.
 */
export function ScrollReveal({ text, as: As = "p", className }: MotionTextProps & { dim?: number }) {
  return <As className={className}>{text}</As>;
}
