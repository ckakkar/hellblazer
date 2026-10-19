"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * A list whose order changes (a row moved up, one removed, one added) shows
 * what happened: each row that moved glides from where it was, and a new one
 * settles in, instead of the list redrawing in its new order. A FLIP on
 * transform and opacity: children marked `data-glide="<key>"` are measured
 * by offsetTop when `order` changes, before paint. `order` is the keys in
 * order, joined.
 */
export function useListGlide(ref: RefObject<HTMLElement | null>, order: string) {
  const last = useRef<Map<string, number> | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>(":scope > [data-glide]")];
    const now = new Map(rows.map((el) => [el.dataset.glide ?? "", el.offsetTop]));
    const before = last.current;
    last.current = now;
    if (!before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const el of rows) {
      const was = before.get(el.dataset.glide ?? "");
      const is = now.get(el.dataset.glide ?? "") ?? 0;
      if (was === undefined) {
        el.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], {
          duration: 260,
          easing: EASE,
        });
      } else if (Math.abs(was - is) >= 1) {
        el.animate([{ transform: `translateY(${was - is}px)` }, { transform: "none" }], {
          duration: 320,
          easing: EASE,
        });
      }
    }
  }, [ref, order]);
}
