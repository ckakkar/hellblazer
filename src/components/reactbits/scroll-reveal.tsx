"use client";

import { useMemo, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
  type UseScrollOptions,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * React Bits `ScrollReveal`: a block of text whose words fade and unblur as it
 * scrolls up the viewport, with the block righting itself from a slight tilt.
 * See ./README.md for provenance and local changes.
 *
 * Rebuilt on `motion` rather than the upstream GSAP + ScrollTrigger. GSAP is
 * roughly 60KB gzipped once ScrollTrigger is in, which is a lot to spend on one
 * reveal, and this repo deliberately ships `motion` as its only animation
 * dependency — so the scrub is `useScroll`, which is passive and only does work
 * while the element is actually on screen.
 *
 * The word progress is scrubbed to scroll position, not fired once on entry:
 * scrolling back up rewinds it, which is the whole point of the effect and the
 * thing that distinguishes it from `BlurText`.
 */
interface ScrollRevealProps {
  children: string;
  /** Blur costs the most to composite; drop it for longer passages. */
  enableBlur?: boolean;
  /**
   * Floor opacity. Kept legible on purpose: this runs on real body copy, and a
   * reader who stops mid-scroll should still be able to read the sentence.
   */
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  className?: string;
}

/**
 * Hoisted so its identity is stable: passing a fresh array literal makes
 * `useScroll` re-create its tracker on every render, which resets progress to
 * zero and leaves the reveal permanently at base opacity.
 */
const REVEAL_OFFSET: UseScrollOptions["offset"] = ["start end", "start 0.8"];

function Word({
  word,
  progress,
  start,
  end,
  baseOpacity,
  blurStrength,
  enableBlur,
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  baseOpacity: number;
  blurStrength: number;
  enableBlur: boolean;
}) {
  const opacity = useTransform(progress, [start, end], [baseOpacity, 1]);
  const blur = useTransform(
    progress,
    [start, end],
    [`blur(${blurStrength}px)`, "blur(0px)"],
  );
  return (
    <motion.span
      className="inline-block"
      style={{ opacity, filter: enableBlur ? blur : undefined }}
    >
      {word}
    </motion.span>
  );
}

function Revealed({
  children,
  enableBlur,
  baseOpacity,
  baseRotation,
  blurStrength,
  className,
}: Required<Omit<ScrollRevealProps, "className">> & { className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // Completion has to be *reachable*. Ending the range at the viewport centre
  // means an element near the bottom of a short page never gets there, so its
  // last words stay stuck at base opacity — unreadable text, permanently. The
  // range therefore closes once the block has risen only a fifth of the way up
  // the viewport, which anything that scrolls into view at all will reach.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: REVEAL_OFFSET,
  });

  const rotate = useTransform(scrollYProgress, [0, 0.35], [baseRotation, 0]);

  // Tokens are resolved up front, each non-space word carrying the slice of the
  // scroll range it owns, so the render pass stays free of a running counter.
  const tokens = useMemo(() => {
    const parts = children.split(/(\s+)/);
    const isSpace = (t: string) => /^\s+$/.test(t);
    const wordSlots = parts
      .map((text, i) => ({ text, i }))
      .filter((x) => !isSpace(x.text));
    const total = wordSlots.length;
    const startAt = new Map(
      wordSlots.map((x, n) => [x.i, total > 1 ? (n / total) * 0.65 : 0]),
    );
    return parts.map((text, i) =>
      isSpace(text)
        ? { text, space: true as const, start: 0 }
        : { text, space: false as const, start: startAt.get(i) ?? 0 },
    );
  }, [children]);

  return (
    <motion.p
      ref={ref}
      style={{ rotate, transformOrigin: "0% 50%" }}
      className={cn("hb-scroll-reveal", className)}
    >
      {tokens.map((t, i) =>
        t.space ? (
          t.text
        ) : (
          <Word
            key={i}
            word={t.text}
            progress={scrollYProgress}
            start={t.start}
            end={Math.min(1, t.start + 0.35)}
            baseOpacity={baseOpacity}
            blurStrength={blurStrength}
            enableBlur={enableBlur}
          />
        ),
      )}
    </motion.p>
  );
}

export function ScrollReveal({
  children,
  enableBlur = true,
  baseOpacity = 0.3,
  baseRotation = 2,
  blurStrength = 4,
  className,
}: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();

  // A separate component rather than an early return, so the scroll hooks below
  // are never conditionally mounted if the preference flips mid-session.
  if (reduceMotion) {
    return <p className={cn(className)}>{children}</p>;
  }

  return (
    <Revealed
      enableBlur={enableBlur}
      baseOpacity={baseOpacity}
      baseRotation={baseRotation}
      blurStrength={blurStrength}
      className={className}
    >
      {children}
    </Revealed>
  );
}

export default ScrollReveal;
