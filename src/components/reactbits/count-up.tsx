"use client";

import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

/**
 * React Bits `CountUp`: springs a number from `from` to `to`. See ./README.md
 * for provenance and local changes.
 *
 * Two local fixes beyond the usual re-theming:
 *
 * 1. **Server-safe.** Upstream renders an empty `<span>` and only writes the
 *    number in an effect, so on a server-rendered page the figure is blank
 *    until hydration. That's fine for a decorative stat and bad for a headline
 *    one, so the formatted target is rendered as real children too.
 * 2. **`animateOnMount`.** For a value that changes while you watch it — the
 *    live tonnage on the workout logger — counting from zero on first paint is
 *    wrong; what carries information is the *move* when a set lands. Passing
 *    `false` seeds the spring at the current value and animates only on change.
 */
interface CountUpProps {
  to: number;
  from?: number;
  direction?: "up" | "down";
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  /** false = don't count up on first paint; animate only when `to` changes. */
  animateOnMount?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

export function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  className = "",
  startWhen = true,
  separator = "",
  animateOnMount = true,
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(
    animateOnMount ? (direction === "down" ? to : from) : to,
  );

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes(".")) {
      const decimals = str.split(".")[1];
      if (parseInt(decimals) !== 0) return decimals.length;
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      const hasDecimals = maxDecimals > 0;
      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      };
      const formatted = Intl.NumberFormat("en-US", options).format(latest);
      return separator ? formatted.replace(/,/g, separator) : formatted;
    },
    [maxDecimals, separator],
  );

  // Reduced motion: paint the final number and skip the spring entirely.
  useEffect(() => {
    if (!ref.current) return;
    if (reduceMotion || !animateOnMount) {
      ref.current.textContent = formatValue(to);
      return;
    }
    ref.current.textContent = formatValue(direction === "down" ? to : from);
  }, [from, to, direction, formatValue, reduceMotion, animateOnMount]);

  useEffect(() => {
    if (reduceMotion || !isInView || !startWhen || !animateOnMount) return;
    onStart?.();
    const timeoutId = setTimeout(() => {
      motionValue.set(direction === "down" ? from : to);
    }, delay * 1000);
    const durationTimeoutId = setTimeout(
      () => onEnd?.(),
      delay * 1000 + duration * 1000,
    );
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(durationTimeoutId);
    };
  }, [
    isInView,
    startWhen,
    motionValue,
    direction,
    from,
    to,
    delay,
    onStart,
    onEnd,
    duration,
    reduceMotion,
    animateOnMount,
  ]);

  // Live values: follow `to` after mount without replaying the intro.
  const mounted = useRef(false);
  useEffect(() => {
    if (animateOnMount) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    motionValue.set(to);
  }, [to, animateOnMount, motionValue]);

  useEffect(() => {
    if (reduceMotion) return;
    const unsubscribe = springValue.on("change", (latest: number) => {
      if (ref.current) ref.current.textContent = formatValue(latest);
    });
    return () => unsubscribe();
  }, [springValue, formatValue, reduceMotion]);

  // Only seed server-side content for the non-animating case. When the intro
  // count is wanted, painting the final figure first would make hydration snap
  // it back to zero before counting — worse than the brief blank it replaces.
  return (
    <span className={className} ref={ref}>
      {animateOnMount ? null : formatValue(to)}
    </span>
  );
}

export default CountUp;
