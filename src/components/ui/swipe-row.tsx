"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";

/** How far the row stays open to show its action. */
const ACTION_WIDTH = 88;
/** Released further left than this, it stays open. */
const OPEN_AT = 44;
/** Swiped past this share of the row's width, it acts on release. */
const FULL_AT = 0.55;
/** Another row opening closes this one. */
const OPEN_EVENT = "hb-swipe-open";
const EASE = "transform 280ms cubic-bezier(0.2, 0.9, 0.3, 1)";

/**
 * A list row that swipes left like Mail's: part way reveals a red action and
 * stays open, all the way (or tapping the action) runs it, with a tick as it
 * crosses that line. One row open at a time; scrolling or tapping the row
 * closes it, and a swipe never counts as a tap on the row. Touch only: with
 * a mouse it's just the row. The row's content needs an opaque background.
 */
export function SwipeRow({
  children,
  onAction,
  label = "Delete",
}: {
  children: ReactNode;
  onAction: () => void;
  label?: string;
}) {
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; from: number; axis: "x" | "y" | null; pointer: number } | null>(null);
  const offset = useRef(0);
  const swiped = useRef(false);
  const pastFull = useRef(false);

  const place = useCallback((x: number, animate: boolean) => {
    offset.current = x;
    const el = content.current;
    if (!el) return;
    el.style.transition = animate ? EASE : "none";
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
  }, []);

  const close = useCallback(() => place(0, true), [place]);

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id && offset.current !== 0) close();
    };
    const onScroll = () => {
      if (offset.current !== 0 && !gesture.current) close();
    };
    window.addEventListener(OPEN_EVENT, onOther);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener(OPEN_EVENT, onOther);
      window.removeEventListener("scroll", onScroll);
    };
  }, [id, close]);

  const act = useCallback(() => {
    place(-(row.current?.offsetWidth ?? 400), true);
    onAction();
  }, [onAction, place]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    gesture.current = { x: e.clientX, y: e.clientY, from: offset.current, axis: null, pointer: e.pointerId };
    swiped.current = false;
    pastFull.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointer) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.axis === "x") {
        row.current?.setPointerCapture(e.pointerId);
        swiped.current = true;
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
      }
    }
    if (g.axis !== "x") return;
    const width = row.current?.offsetWidth ?? 400;
    let x = g.from + dx;
    // Rightwards past closed, it resists.
    if (x > 0) x /= 4;
    const full = -x > width * FULL_AT;
    if (full !== pastFull.current) {
      pastFull.current = full;
      haptic("tick");
    }
    place(Math.max(x, -width), false);
  }

  function onPointerEnd(e: React.PointerEvent) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || e.pointerId !== g.pointer || g.axis !== "x") return;
    if (pastFull.current) {
      act();
    } else if (-offset.current > OPEN_AT) {
      place(-ACTION_WIDTH, true);
    } else {
      close();
    }
  }

  // After a swipe, or while open, a tap on the row only closes it.
  function onClickCapture(e: React.MouseEvent) {
    if ((e.target as Element).closest("[data-swipe-action]")) return;
    if (swiped.current || offset.current !== 0) {
      e.preventDefault();
      e.stopPropagation();
      swiped.current = false;
      if (offset.current !== 0) close();
    }
  }

  return (
    <div
      ref={row}
      className="relative overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <button
        type="button"
        data-swipe-action
        tabIndex={-1}
        aria-hidden
        onClick={act}
        className="absolute inset-y-0 right-0 flex w-full items-center justify-end bg-danger pr-5 text-[15px] font-semibold text-white"
      >
        {label}
      </button>
      <div ref={content} className="relative">
        {children}
      </div>
    </div>
  );
}
