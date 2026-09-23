import { ViewTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * The route loader: a competition bar being loaded, plate by plate.
 *
 * Deliberately a server component with zero client JS. `loading.tsx` is the
 * first thing the App Router streams for a navigation, so this has to paint
 * before any bundle for the destination route arrives. Every moving part is
 * CSS (the `.hb-bar-*` rules in globals.css) against this static SVG.
 *
 * The cycle is how a bar is really loaded: the 25s go on first, then 20s,
 * 15s, a change plate and the collars, and the readout counts every one of
 * them to a true 150 kg (20 kg bar, 25/20/15/2.5 a side, 2.5 kg collars).
 * It holds, then strips outermost first and goes again.
 *
 * The base styles are the loaded bar. Reduced motion switches the animations
 * off entirely, which leaves a full, still bar reading 150 rather than an
 * empty one.
 *
 * Geometry is symmetric about x=220 in a 440x120 viewBox, proportioned from
 * an IWF bar and plates (then thickened a touch so they read at phone size).
 * `LEFT` is the left side from the sleeve shoulder outward; the right mirrors.
 */

type Plate = {
  part: "p1" | "p2" | "p3" | "p4" | "clip";
  x: number;
  w: number;
  h: number;
  fill: string;
  hub?: boolean;
};

const LEFT: Plate[] = [
  { part: "p1", x: 83, w: 13, h: 100, fill: "url(#hb-bar-hot)", hub: true }, // 25 kg
  { part: "p2", x: 71, w: 11, h: 100, fill: "url(#hb-bar-iron)", hub: true }, // 20 kg
  { part: "p3", x: 61, w: 9, h: 100, fill: "url(#hb-bar-iron)", hub: true }, // 15 kg
  { part: "p4", x: 55, w: 5, h: 38, fill: "url(#hb-bar-steel)" }, // 2.5 kg
  { part: "clip", x: 45, w: 9, h: 24, fill: "url(#hb-bar-steel)" }, // collar, 2.5 kg
];

const CY = 60;
const mirror = (x: number, w: number) => 440 - x - w;

export function PlateLoader({
  label,
  className,
}: {
  /** The destination's name, for screen readers, e.g. "Progress". */
  label?: string;
  className?: string;
}) {
  return (
    <ViewTransition exit="hb-loader-out" default="none">
      <div
        aria-busy="true"
        className={cn(
          "hb-bar-loader flex min-h-[72dvh] flex-col items-center justify-center text-center md:min-h-[78dvh]",
          className,
        )}
      >
        <svg aria-hidden viewBox="0 0 440 120" className="w-full max-w-[25rem] overflow-visible">
          <defs>
            {/* Machined steel, kept darker than the readout below it. */}
            <linearGradient id="hb-bar-steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8f8e8a" />
              <stop offset="38%" stopColor="#c9c7c2" />
              <stop offset="100%" stopColor="#4a4a4d" />
            </linearGradient>
            {/* The 25s wear the accent, the way a red 25 does on a platform.
                A plate is edge-on here, so its rim catches light like a
                cylinder: lit near the top, falling away at both ends. */}
            <linearGradient id="hb-bar-hot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent-dim-rgb))" />
              <stop offset="10%" stopColor="rgb(var(--accent-rgb))" />
              <stop offset="55%" stopColor="rgb(var(--accent-rgb))" />
              <stop offset="100%" stopColor="rgb(var(--accent-dim-rgb))" />
            </linearGradient>
            <linearGradient id="hb-bar-iron" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#25252a" />
              <stop offset="10%" stopColor="#46464c" />
              <stop offset="55%" stopColor="#2d2d32" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
            <pattern id="hb-bar-knurl" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
              <path d="M0 2.5L2.5 0M0 0L2.5 2.5" stroke="#000" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Shaft, with the grip knurl and the centre knurl */}
          <rect x="104" y={CY - 2.5} width="232" height="5" rx="2.5" fill="url(#hb-bar-steel)" />
          <rect x="126" y={CY - 2.5} width="68" height="5" fill="url(#hb-bar-knurl)" opacity="0.5" />
          <rect x="246" y={CY - 2.5} width="68" height="5" fill="url(#hb-bar-knurl)" opacity="0.5" />
          <rect x="211" y={CY - 2.5} width="18" height="5" fill="url(#hb-bar-knurl)" opacity="0.35" />

          {/* Sleeves, their shoulders, and end caps */}
          <rect x="22" y={CY - 5} width="74" height="10" rx="1.5" fill="url(#hb-bar-steel)" />
          <rect x="344" y={CY - 5} width="74" height="10" rx="1.5" fill="url(#hb-bar-steel)" />
          <rect x="96" y={CY - 8} width="8" height="16" rx="2" fill="url(#hb-bar-steel)" />
          <rect x="336" y={CY - 8} width="8" height="16" rx="2" fill="url(#hb-bar-steel)" />
          <rect x="20" y={CY - 5.5} width="3" height="11" rx="1" fill="#5c5c60" />
          <rect x="417" y={CY - 5.5} width="3" height="11" rx="1" fill="#5c5c60" />

          {LEFT.flatMap((p) =>
            (["l", "r"] as const).map((side) => {
              const x = side === "l" ? p.x : mirror(p.x, p.w);
              return (
                <g key={`${p.part}${side}`} className={`hb-bar-part hb-bar-${p.part}`} data-side={side}>
                  <rect x={x} y={CY - p.h / 2} width={p.w} height={p.h} rx={p.hub ? 3 : 1.5} fill={p.fill} />
                  {/* The steel hub insert stands just proud of each face. */}
                  {p.hub && (
                    <rect x={x - 1} y={CY - 11} width={p.w + 2} height="22" rx="1.5" fill="url(#hb-bar-steel)" />
                  )}
                </g>
              );
            }),
          )}
        </svg>

        {/* The weight on the bar, counting as each plate seats */}
        <p aria-hidden className="mt-8 flex items-baseline justify-center gap-1.5">
          <span className="hb-bar-kg font-display inline-block min-w-[3ch] text-right text-[clamp(3rem,14vw,4rem)] leading-none text-text" />
          <span className="text-[17px] font-medium text-muted">kg</span>
        </p>

        {/* Narrates the step on screen; stacked so nothing reflows */}
        <p aria-hidden className="relative mt-3 h-5 w-48 text-[15px] text-muted">
          <span className="hb-bar-say hb-bar-say-1 absolute inset-0">Loading the bar</span>
          <span className="hb-bar-say hb-bar-say-2 absolute inset-0">Collars on</span>
        </p>

        <span className="sr-only" role="status">
          {label ? `Loading ${label}` : "Loading"}
        </span>
      </div>
    </ViewTransition>
  );
}
