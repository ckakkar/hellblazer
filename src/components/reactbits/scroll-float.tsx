import type { MotionTextProps } from "./scroll-text-types";

/**
 * React Bits' ScrollFloat, on a CSS view timeline: each character floats up
 * into place as the line scrolls into view, scrubbed by the scroll.
 * STUB: renders the text; the partner builds the motion.
 */
export function ScrollFloat({ text, as: As = "h2", className }: MotionTextProps) {
  return <As className={className}>{text}</As>;
}
