import type { CSSProperties } from "react";
import type { MotionTextProps } from "./scroll-text-types";
import { motionTextParts } from "./split-text";
import "./scroll-motion.css";

/** A headline floats up, grapheme by grapheme, on its own view timeline. */
export function ScrollFloat({ text, as: As = "h2", className = "" }: MotionTextProps) {
  const { parts, count } = motionTextParts(text, "char");
  return <As className={`rb-scroll-float ${className}`} style={{ "--motion-count": count } as CSSProperties}><span className="sr-only">{text}</span>{parts}</As>;
}
