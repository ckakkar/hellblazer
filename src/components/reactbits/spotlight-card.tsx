"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * React Bits `SpotlightCard`: a soft radial highlight tracks the pointer across
 * the card. See ./README.md for provenance and local changes.
 *
 * Local changes beyond the usual: upstream bakes in `rounded-3xl`,
 * `border-neutral-800`, `bg-neutral-900` and `p-8`. All of that is stripped so
 * this composes with the app's `Card` instead of fighting it. The highlight is
 * the accent token, so it re-skins with `html[data-accent]`.
 *
 * Pointer-driven only, so there is no animation loop and nothing to do on
 * touch, where it simply never activates.
 */
export function SpotlightCard({
  children,
  className,
  style,
  spotlightOpacity = 0.09,
  as: Tag = "div",
}: {
  children?: ReactNode;
  className?: string;
  /** Passed through for stagger delays (`animationDelay`) on list rows. */
  style?: CSSProperties;
  /** Peak alpha of the accent wash. Keep it low: this is chrome, not a light show. */
  spotlightOpacity?: number;
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [lit, setLit] = useState(false);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      onPointerMove={(e: React.PointerEvent) => {
        // Touch drags shouldn't smear a highlight across a scrolling list.
        if (e.pointerType !== "mouse" || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onPointerEnter={(e: React.PointerEvent) => {
        if (e.pointerType === "mouse") setLit(true);
      }}
      onPointerLeave={() => setLit(false)}
      className={cn("relative overflow-hidden", className)}
      style={style}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out"
        style={{
          opacity: lit ? 1 : 0,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, rgb(var(--accent-rgb) / ${spotlightOpacity}), transparent 70%)`,
        }}
      />
      {children}
    </Tag>
  );
}

export default SpotlightCard;
