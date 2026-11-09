"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Mounts a Recharts chart just after the page arrives, one chart per task,
 * with a placeholder of the chart's own height until then (so nothing moves).
 * Mounting a page's charts together was one long task: Progress's Lifts and
 * Muscles switch stalled 121ms on a throttled phone while the page changed.
 * Split up, the switch stays smooth and each chart draws in (.hb-chart-draw)
 * a beat later. Charts never rendered on the server anyway (they measure
 * their width first).
 */

const queue: Array<() => void> = [];
let pumping = false;

/** After the next paint, then once more after each chart's own paint. */
const later = (fn: () => void) =>
  requestAnimationFrame(() => setTimeout(fn, 0));

function pump() {
  if (pumping) return;
  pumping = true;
  const next = () => {
    const run = queue.shift();
    if (!run) {
      pumping = false;
      return;
    }
    run();
    later(next);
  };
  later(next);
}

export function DeferredChart({
  height,
  children,
}: {
  height: number;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    queue.push(() => {
      if (live) setReady(true);
    });
    pump();
    return () => {
      live = false;
    };
  }, []);
  if (!ready) return <div aria-hidden style={{ height }} />;
  return children;
}
