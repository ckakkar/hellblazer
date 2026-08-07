import { cn } from "@/lib/utils";

/**
 * The route loader: a barbell being loaded, plate by plate.
 *
 * Deliberately a server component with zero client JS. `loading.tsx` is the
 * first thing the App Router streams for a navigation, so the loader has to
 * paint before any bundle for the destination route is fetched. Everything
 * animated here (plate fly-in, the climbing counter, the cycling call-out)
 * is CSS in globals.css against this static SVG.
 *
 * Geometry is symmetric about x=220 in a 440-wide viewBox: plates are seated
 * against inner collars and fly in from off-frame, innermost (heaviest) first,
 * which is the order you'd actually load a bar.
 */

const PHRASES = ["Loading the bar", "Squaring the collars", "Taking your mark"];

/** Plate pairs, innermost first. `w`/`h` in viewBox units; `x` is the left side. */
const PLATES = [
  { x: 124, w: 16, h: 84, delay: 0, accent: true },
  { x: 105, w: 15, h: 64, delay: 0.16, accent: false },
  { x: 88, w: 13, h: 46, delay: 0.32, accent: false },
];

export function PlateLoader({
  label,
  className,
}: {
  /** Route name shown as the eyebrow, e.g. "King of the Hill". */
  label?: string;
  className?: string;
}) {
  const vignette = "radial-gradient(circle at 50% 42%, black, transparent 62%)";

  return (
    <div
      aria-busy="true"
      className={cn(
        "relative flex min-h-[58vh] flex-col items-center justify-center overflow-hidden px-6 text-center",
        className,
      )}
    >
      {/* Faint manga texture, faded out from the centre so it never competes. */}
      <div
        aria-hidden
        className="hb-speedlines pointer-events-none absolute inset-0 opacity-25"
        style={{ maskImage: vignette, WebkitMaskImage: vignette }}
      />
      <div
        aria-hidden
        className="hb-halftone pointer-events-none absolute inset-0 opacity-20"
        style={{ maskImage: vignette, WebkitMaskImage: vignette }}
      />
      {/* No 力 watermark here on purpose: behind the bar it read as a smudge
          cutting through the plates, and the barbell already carries the
          identity on its own. */}

      {label && (
        <div className="relative mb-7 font-mono text-[10px] uppercase tracking-[0.32em] text-muted/70">
          {label}
        </div>
      )}

      {/* ── The bar ──────────────────────────────────────────────────────── */}
      <svg
        aria-hidden
        viewBox="0 0 440 140"
        className="relative w-full max-w-[26rem] overflow-visible"
      >
        <defs>
          {/* Gunmetal, not chrome: the counter has to stay the brightest thing
              in the frame, so the bar reads as a dim machined surface. */}
          <linearGradient id="hb-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a4542" />
            <stop offset="42%" stopColor="#8a837c" />
            <stop offset="100%" stopColor="#37322f" />
          </linearGradient>
          <linearGradient id="hb-plate-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2724" />
            <stop offset="55%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#121010" />
          </linearGradient>
          {/* The heavy pair is crimson-tinted iron, so its rim reads as hot
              metal rather than a hollow neon rectangle. */}
          <linearGradient id="hb-plate-hot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d2523" />
            <stop offset="55%" stopColor="#261715" />
            <stop offset="100%" stopColor="#170f0f" />
          </linearGradient>
        </defs>

        {/* Shaft + knurling */}
        <rect x="56" y="66" width="328" height="8" rx="4" fill="url(#hb-steel)" />
        {[210, 220, 230].map((x) => (
          <rect
            key={x}
            x={x}
            y="66"
            width="1.5"
            height="8"
            fill="#0f0d0c"
            opacity="0.5"
          />
        ))}

        {/* Inner collars: what the plates seat against */}
        {[142, 291].map((x) => (
          <rect
            key={x}
            x={x}
            y="57"
            width="7"
            height="26"
            rx="2"
            fill="url(#hb-steel)"
          />
        ))}

        {/* Plates, mirrored about the centre. Left flies in from the left. */}
        {PLATES.map(({ x, w, h, delay, accent }) =>
          (["L", "R"] as const).map((side) => {
            const px = side === "L" ? x : 440 - x - w;
            return (
              <rect
                key={`${side}${x}`}
                className="hb-plate"
                x={px}
                y={70 - h / 2}
                width={w}
                height={h}
                rx="3"
                fill={`url(#hb-plate-${accent ? "hot" : "face"})`}
                // The heavy pair carries a warm rim; the rest get a machined
                // edge that's light enough to actually read against the base.
                stroke={accent ? "rgb(var(--accent-rgb) / 0.55)" : "#413b37"}
                strokeWidth={accent ? 1.25 : 1}
                style={{
                  // Fly-in origin, off-frame on that plate's own side.
                  ["--hb-plate-from" as string]:
                    side === "L" ? "-150px" : "150px",
                  animationDelay: `${delay}s`,
                  filter: accent
                    ? "drop-shadow(0 0 5px rgb(var(--accent-rgb) / 0.18))"
                    : undefined,
                }}
              />
            );
          }),
        )}
      </svg>

      {/* ── The load ─────────────────────────────────────────────────────── */}
      <div className="relative mt-8 flex items-baseline gap-2">
        <span className="hb-kg font-impact text-4xl leading-none tabular-nums text-text sm:text-5xl" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          kg
        </span>
      </div>

      <div className="relative mt-5 h-px w-40 bg-border" />

      {/* Cycling call-out. Stacked so the box never changes height. */}
      <div className="relative mt-5 h-4 w-full">
        {PHRASES.map((phrase, i) => (
          <span
            key={phrase}
            className="hb-phrase absolute inset-x-0 font-mono text-[11px] uppercase tracking-[0.26em] text-muted"
            style={{ animationDelay: `${i * 2.8}s` }}
          >
            {phrase}
          </span>
        ))}
      </div>

      <span className="sr-only" role="status">
        {label ? `Loading ${label}` : "Loading"}
      </span>
    </div>
  );
}
