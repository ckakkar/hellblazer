"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const SEEN_KEY = "hb-week-grown";

/**
 * The first time the dashboard shows a workout's sets, each bar it added to
 * grows from where the muscle stood before it to where it is now, so what
 * the session did for the week is visible at a glance. Once per workout, per
 * device. Bars mark their starting point with `data-grow` (a fraction of the
 * final length); they slide out from under the track's left edge, so only
 * transform moves.
 */
export function WeekGrowth({
  sessionId,
  className,
  children,
}: {
  sessionId: string | null;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!sessionId || !root) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === sessionId) return;
      localStorage.setItem(SEEN_KEY, sessionId);
    } catch {
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.querySelectorAll<HTMLElement>("[data-grow]").forEach((bar, i) => {
      const from = Number(bar.dataset.grow);
      if (!(from >= 0 && from < 1)) return;
      bar.animate([{ transform: `translateX(${(from - 1) * 100}%)` }, { transform: "none" }], {
        duration: 720,
        delay: 160 + i * 50,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      });
    });
  }, [sessionId]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
