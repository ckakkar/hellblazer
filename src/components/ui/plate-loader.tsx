import { ViewTransition, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The route loader: a competition bar being loaded, plate by plate.
 *
 * Deliberately a server component with zero client JS. `loading.tsx` is the
 * first thing the App Router streams for a navigation, so this has to paint
 * before any bundle for the destination route arrives. The choreography is
 * CSS (the `.hb-bar-*` rules in globals.css).
 *
 * It runs exactly while the main thread is busiest (the next page's payload
 * and hydration), so everything that moves is an HTML element animating only
 * transform and opacity, which the compositor runs off the main thread. The
 * static bar is SVG; the plates, collars and readout digits are divs laid over
 * it.
 *
 * The cycle is how a bar is really loaded: the 25s go on first, then 20s,
 * 15s, a change plate and the collars, each slid on from the end of the
 * sleeve, heavier ones slower. The readout changes digit by digit as each
 * one seats, to a true 150 kg (20 kg bar, 25/20/15/2.5 a side, 2.5 kg
 * collars). It holds, strips outermost first, and goes again.
 *
 * The base styles are the loaded bar reading 150. Reduced motion switches the
 * animations off entirely, which leaves exactly that.
 *
 * Geometry is in viewBox units of a 440x120 box, symmetric about x=220 and
 * proportioned from an IWF bar and plates (thickened a touch so they read at
 * phone size). Only the left side is described; the right is the same markup
 * mirrored.
 */

type Part = {
  part: "p1" | "p2" | "p3" | "p4" | "clip";
  x: number;
  w: number;
  h: number;
  finish: "hot" | "iron" | "steel";
};

const LEFT: Part[] = [
  { part: "p1", x: 83, w: 13, h: 100, finish: "hot" }, // 25 kg
  { part: "p2", x: 71, w: 11, h: 100, finish: "iron" }, // 20 kg
  { part: "p3", x: 61, w: 9, h: 100, finish: "iron" }, // 15 kg
  { part: "p4", x: 55, w: 5, h: 38, finish: "steel" }, // 2.5 kg change plate
  { part: "clip", x: 45, w: 9, h: 24, finish: "steel" }, // collar, 2.5 kg
];

const CY = 60;

function Side({ mirrored }: { mirrored?: boolean }) {
  return (
    <div className={cn("absolute inset-0", mirrored && "-scale-x-100")}>
      {LEFT.map((p) => (
        <div
          key={p.part}
          className={`hb-bar-part hb-bar-${p.part} hb-bar-${p.finish}`}
          style={{ "--x": p.x, "--y": CY - p.h / 2, "--w": p.w, "--h": p.h } as CSSProperties}
        >
          {/* The steel hub insert stands just proud of each face. */}
          {p.h === 100 && <div className="hb-bar-hub" />}
        </div>
      ))}
    </div>
  );
}

/** One digit position: the figures it will show, stacked; CSS rolls between them. */
function Slot({ place, digits }: { place: string; digits: string[] }) {
  return (
    <span className="hb-bar-slot">
      <span className="invisible">0</span>
      {digits.map((d, i) => (
        <span key={i} className={`hb-bar-d hb-bar-${place}${i}`}>
          {d}
        </span>
      ))}
    </span>
  );
}

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
        <div aria-hidden className="hb-bar relative aspect-[440/120] w-full max-w-[25rem]">
          <svg viewBox="0 0 440 120" className="absolute inset-0 size-full overflow-visible">
            <defs>
              {/* Machined steel, kept darker than the readout below it. */}
              <linearGradient id="hb-bar-steel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8f8e8a" />
                <stop offset="38%" stopColor="#c9c7c2" />
                <stop offset="100%" stopColor="#4a4a4d" />
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
          </svg>
          <Side />
          <Side mirrored />
        </div>

        {/* The weight on the bar. The number is centred on its own; the unit
            trails it, balanced by an invisible twin on the left. */}
        <p
          aria-hidden
          className="hb-bar-readout mt-8 flex items-baseline justify-center text-[clamp(3rem,14vw,4rem)] leading-none"
        >
          <span className="invisible pr-1.5 text-[17px] font-medium">kg</span>
          <span className="font-display flex text-text">
            <Slot place="h" digits={["1"]} />
            <Slot place="t" digits={["2", "7", "1", "4", "5"]} />
            <Slot place="o" digits={["0", "5"]} />
          </span>
          <span className="pl-1.5 text-[17px] font-medium text-muted">kg</span>
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
