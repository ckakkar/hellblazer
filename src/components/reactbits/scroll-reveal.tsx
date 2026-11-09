import type { CSSProperties } from "react";
import type { MotionTextProps } from "./scroll-text-types";
import { motionTextParts } from "./split-text";
import "./scroll-motion.css";

/** Words light up in reading order as the block crosses the viewport. */
export function ScrollReveal({ text, as: As = "p", className = "", dim = 0.16 }: MotionTextProps & { dim?: number }) {
  const { parts, count } = motionTextParts(text, "word");
  return <As className={`rb-scroll-reveal ${className}`} style={{ "--motion-count": count, "--motion-dim": Math.min(1, Math.max(0, dim)) } as CSSProperties}><span className="sr-only">{text}</span>{parts}</As>;
}
