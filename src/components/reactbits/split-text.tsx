import { Fragment, type CSSProperties } from "react";
import type { MotionTextProps } from "./scroll-text-types";
import "./scroll-motion.css";

/** Shared SSR splitting: whole words wrap, grapheme clusters never split. */
export function motionTextParts(text: string, by: "char" | "word") {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let count = 0;
  const parts = text.replace(/\r\n?/g, "\n").split(/(\n|[^\S\n]+)/u).map((part, i) => {
    if (part === "\n") return <br key={i} aria-hidden="true" />;
    if (!part || /^\s+$/u.test(part)) return <Fragment key={i}>{part}</Fragment>;
    if (by === "word") {
      return <span key={i} aria-hidden="true" className="rb-motion-word rb-reveal-word" style={{ "--motion-i": count++ } as CSSProperties}>{part}</span>;
    }
    return (
      <span key={i} aria-hidden="true" className="rb-motion-word">
        {Array.from(segmenter.segment(part), ({ segment }) => (
          <span key={count} className="rb-motion-char" style={{ "--motion-i": count++ } as CSSProperties}>{segment}</span>
        ))}
      </span>
    );
  });
  return { parts, count: Math.max(1, count) };
}

/** SplitText's once-only entrance; its readable final state is the base CSS. */
export function SplitText({ text, as: As = "span", className = "", delayMs = 0, stepMs = 28 }: MotionTextProps & { delayMs?: number; stepMs?: number }) {
  const { parts } = motionTextParts(text, "char");
  return (
    <As className={`rb-split-text ${className}`} style={{ "--motion-delay": `${Math.max(0, delayMs)}ms`, "--motion-step": `${Math.max(0, stepMs)}ms` } as CSSProperties}>
      <span className="sr-only">{text}</span>{parts}
    </As>
  );
}
