import { ViewTransition, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The route loader: a competition bar being loaded, the way it's done on a
 * platform.
 *
 * Deliberately a server component with zero client JS. `loading.tsx` is the
 * first thing the App Router streams for a navigation, so this has to paint
 * before any bundle for the destination route arrives. The choreography is
 * CSS (the `.hb-bar-*` rules in globals.css).
 *
 * It runs while the main thread is busiest (the next page's payload and
 * hydration), so everything that moves is an HTML element animating only
 * transform and opacity, which the compositor runs off the main thread. The
 * static bar is SVG; the plates, collars and readout digits are divs over it.
 *
 * What makes it read as real:
 * - IWF competition bumpers: red 25s, blue 20s, yellow 15s, a red 2.5 change
 *   plate, chrome collars with levers, drawn to competition proportions
 *   (a 28 mm shaft, 50 mm sleeves, 450 mm plates) and lit like rubber and
 *   chrome rather than flat colour;
 * - plates come in from beyond the frame, are pushed along the sleeve, and
 *   stop hard against the stack with a small rubber rebound;
 * - each collar slides on and then its lever snaps shut; stripping opens
 *   the levers first and pulls the plates off outermost first;
 * - the readout ticks over as each pair lands, to a true 150 kg (20 kg bar,
 *   25/20/15/2.5 a side, 2.5 kg collars).
 *
 * The base styles are the loaded bar with the collars clamped, reading 150.
 * Reduced motion switches the animations off, which leaves exactly that.
 *
 * Geometry is in viewBox units of a 440x120 box, symmetric about x=220.
 * Only the left side is described; the right is the same markup mirrored.
 */

type Part = {
  part: "p1" | "p2" | "p3" | "p4" | "clip";
  x: number;
  w: number;
  h: number;
  finish: "red" | "blue" | "yellow" | "chrome";
};

const LEFT: Part[] = [
  { part: "p1", x: 82, w: 13, h: 100, finish: "red" }, // 25 kg
  { part: "p2", x: 70, w: 11, h: 100, finish: "blue" }, // 20 kg
  { part: "p3", x: 60, w: 9, h: 100, finish: "yellow" }, // 15 kg
  { part: "p4", x: 54.5, w: 4.5, h: 46, finish: "red" }, // 2.5 kg change plate
  { part: "clip", x: 43.5, w: 10, h: 24, finish: "chrome" }, // collar, 2.5 kg
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
          {/* The steel hub insert, standing just proud of each face */}
          {p.h === 100 && <div className="hb-bar-hub" />}
          {/* The collar's clamp lever */}
          {p.part === "clip" && <div className="hb-bar-lever" />}
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
              {/* Chrome: a bright band where the light catches the top, a
                  dark reflected band under it, a little bounce at the foot */}
              <linearGradient id="hb-bar-chrome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5d5d61" />
                <stop offset="20%" stopColor="#efeee9" />
                <stop offset="42%" stopColor="#a4a29d" />
                <stop offset="68%" stopColor="#434347" />
                <stop offset="100%" stopColor="#8b8985" />
              </linearGradient>
              {/* The shaft is satin, not polished: softer than the sleeves */}
              <linearGradient id="hb-bar-satin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6f6e6b" />
                <stop offset="38%" stopColor="#bebcb7" />
                <stop offset="100%" stopColor="#4c4c50" />
              </linearGradient>
              <pattern id="hb-bar-knurl" width="2" height="2" patternUnits="userSpaceOnUse">
                <path d="M0 2L2 0M0 0L2 2" stroke="#000" strokeWidth="0.45" />
              </pattern>
            </defs>

            {/* Shaft, 28 mm: grip knurl either side, centre knurl between */}
            <rect x="104" y={CY - 3} width="232" height="6" rx="3" fill="url(#hb-bar-satin)" />
            <rect x="124" y={CY - 3} width="72" height="6" fill="url(#hb-bar-knurl)" opacity="0.55" />
            <rect x="244" y={CY - 3} width="72" height="6" fill="url(#hb-bar-knurl)" opacity="0.55" />
            <rect x="210" y={CY - 3} width="20" height="6" fill="url(#hb-bar-knurl)" opacity="0.4" />

            {/* Sleeves, 50 mm, with their shoulders and end caps */}
            {[
              { sleeve: 20, shoulder: 95, cap: 17 },
              { sleeve: 345, shoulder: 336, cap: 420 },
            ].map((s) => (
              <g key={s.sleeve}>
                <rect x={s.sleeve} y={CY - 5.5} width="75" height="11" rx="1.5" fill="url(#hb-bar-chrome)" />
                <rect x={s.shoulder} y={CY - 9} width="9" height="18" rx="2" fill="url(#hb-bar-chrome)" />
                <rect
                  x={s.shoulder === 95 ? 95 : 344}
                  y={CY - 9}
                  width="1"
                  height="18"
                  fill="#000"
                  opacity="0.35"
                />
                <rect x={s.cap} y={CY - 6} width="3" height="12" rx="1.2" fill="#56565a" />
              </g>
            ))}
          </svg>

          {/* Plates travel on their own layer, clipped to the frame and
              faded at its edges, so they arrive from beyond it. */}
          <div className="hb-bar-plates absolute inset-0 overflow-hidden">
            <Side />
            <Side mirrored />
          </div>
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
