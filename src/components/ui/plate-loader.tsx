import { cn } from "@/lib/utils";

/** Zero-JS route transition: the corner loads the bar before the next card. */

const PHRASES = ["Loading the iron", "Locking the collars", "Calling your corner"];

const PLATES = [
  { x: 105, width: 18, height: 86, delay: 0, accent: true },
  { x: 84, width: 16, height: 66, delay: 0.14, accent: false },
  { x: 66, width: 13, height: 48, delay: 0.28, accent: false },
] as const;

export function PlateLoader({
  label,
  className,
}: {
  /** Route name shown as the eyebrow, e.g. "King of the Hill". */
  label?: string;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "relative flex min-h-[58vh] flex-col items-center justify-center overflow-hidden px-6 text-center",
        className,
      )}
    >
      <div className="hb-loader-card hb-panel-cut relative overflow-hidden border-y-2 border-text/80 px-5 py-6 text-left sm:px-7 sm:py-8">
        <span aria-hidden className="absolute -right-3 -top-8 font-impact text-[9rem] leading-none text-text/[0.025]">II</span>
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.26em] text-muted">
          <span>{label ?? "Hell Blazer"}</span>
          <span className="hb-loader-mark text-accent">corner active</span>
        </div>

        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">Between rounds</div>
            <div className="mt-1 font-impact text-4xl uppercase leading-[0.82] text-text sm:text-5xl">
              Ready the <span className="text-accent">bar.</span>
            </div>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted/60">No shortcuts</span>
        </div>

        <svg
          aria-hidden
          viewBox="0 0 360 132"
          className="mt-5 w-full overflow-visible"
        >
          <defs>
            <linearGradient id="hb-loader-steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b0a79f" />
              <stop offset="48%" stopColor="#625b56" />
              <stop offset="100%" stopColor="#302b28" />
            </linearGradient>
            <linearGradient id="hb-loader-iron" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#302a27" />
              <stop offset="55%" stopColor="#171412" />
              <stop offset="100%" stopColor="#0d0b0a" />
            </linearGradient>
            <linearGradient id="hb-loader-hot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent-rgb) / 0.48)" />
              <stop offset="55%" stopColor="rgb(var(--accent-dim-rgb) / 0.55)" />
              <stop offset="100%" stopColor="#140d0c" />
            </linearGradient>
          </defs>

          <rect x="35" y="63" width="290" height="7" rx="1" fill="url(#hb-loader-steel)" />
          <rect x="128" y="55" width="7" height="23" rx="1" fill="url(#hb-loader-steel)" />
          <rect x="225" y="55" width="7" height="23" rx="1" fill="url(#hb-loader-steel)" />
          <g opacity="0.35">
            <path d="M168 63v7M174 63v7M180 63v7M186 63v7M192 63v7" stroke="#0b0908" strokeWidth="1" />
          </g>

          {PLATES.flatMap((plate) =>
            (["left", "right"] as const).map((side) => {
              const x = side === "left" ? plate.x : 360 - plate.x - plate.width;
              return (
                <rect
                  key={`${side}-${plate.x}`}
                  className="hb-loader-plate"
                  x={x}
                  y={66.5 - plate.height / 2}
                  width={plate.width}
                  height={plate.height}
                  rx="2"
                  fill={`url(#hb-loader-${plate.accent ? "hot" : "iron"})`}
                  stroke={plate.accent ? "rgb(var(--accent-rgb) / 0.7)" : "#4a423d"}
                  style={{
                    ["--hb-loader-from" as string]: side === "left" ? "-120px" : "120px",
                    animationDelay: `${plate.delay}s`,
                  }}
                />
              );
            }),
          )}
        </svg>

        <div className="h-px overflow-hidden bg-border">
          <div className="hb-loader-scan h-full bg-accent" />
        </div>
        <div className="relative mt-3 h-4">
          {PHRASES.map((phrase, index) => (
            <span
              key={phrase}
              className="hb-loader-phrase absolute inset-x-0 font-mono text-[9px] uppercase tracking-[0.24em] text-muted"
              style={{ animationDelay: `${index * 0.9}s` }}
            >
              {phrase}
            </span>
          ))}
        </div>
      </div>

      <span className="sr-only" role="status">
        {label ? `Loading ${label}` : "Loading"}
      </span>
    </div>
  );
}
