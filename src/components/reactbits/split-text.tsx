import type { MotionTextProps } from "./scroll-text-types";

/**
 * React Bits' SplitText, on CSS alone: each character rises into place once,
 * on load, one after another (`delayMs` before the first, `stepMs` between).
 * STUB: renders the text; the partner builds the motion.
 */
export function SplitText({
  text,
  as: As = "span",
  className,
}: MotionTextProps & { delayMs?: number; stepMs?: number }) {
  return <As className={className}>{text}</As>;
}
