"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * When `key` changes and the element has been pushed down (or pulled up) by
 * something above it, it glides from where it was instead of jumping there.
 * A FLIP on transform only, measured before paint, so it's one layout read per
 * change and the animation itself runs on the compositor. It measures the
 * layout position (offsetTop), which a sheet sliding in or a scroll doesn't
 * change.
 */
export function useGlide(ref: RefObject<HTMLElement | null>, key: unknown) {
  const last = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.offsetTop;
    const prev = last.current;
    last.current = top;
    if (prev === null || Math.abs(prev - top) < 1) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "none" }], {
      duration: 340,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  }, [ref, key]);
}
