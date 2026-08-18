"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { BlurText } from "@/components/reactbits/blur-text";
import { SplitFlapText } from "@/components/reactbits/split-flap-text";

/**
 * The bootloader: what the installed app shows while it wakes up.
 *
 * iOS already paints a static launch image over a cold PWA start (see
 * `startupImage` in the root layout), but that image is dropped the moment the
 * document paints, which on a phone is long before React has hydrated and the
 * first route has streamed. What used to fill that gap was a bare shell. This
 * fills it with a boot sequence instead: the same near-black arena, the
 * wordmark, a load meter that climbs, and a POST-style log.
 *
 * Two rules shape the implementation:
 *
 *  1. **It must paint before any JS runs.** The chrome (wordmark, meter,
 *     percentage, log lines) is pure CSS in `globals.css` against
 *     server-rendered markup, so it animates from the very first frame, not
 *     from hydration. The React Bits pieces below layer on afterwards, which
 *     is exactly the tell that the app has come alive.
 *  2. **It must never trap the user.** Hydration flips it out; if hydration
 *     never happens, the CSS failsafe in `.hb-boot[data-phase="boot"]` lifts
 *     the sheet on its own after ~9s.
 *
 * Browser tabs never see it: `.hb-boot` is `display: none` outside
 * `display-mode: standalone`, so there is no flash on the marketing page and
 * nothing to hide after the fact. (That media query is the single source of
 * truth. iOS ≤16.3 reports standalone only through `navigator.standalone`;
 * those launches simply get the old behaviour rather than a splash that pops
 * in late, after hydration, which is the one moment it would be pointless.)
 */

/** Held at least this long once mounted, so a warm start can't strobe. */
const MIN_VISIBLE_MS = 1100;
/** Hard ceiling from mount: a slow network never holds the app hostage. */
const MAX_VISIBLE_MS = 5200;
/** Matches the .hb-boot exit transition in globals.css. */
const EXIT_MS = 420;

/** POST log. Real subsystems, in the order they actually come up. */
const BOOT_LOG = [
  "blaze core",
  "session link",
  "row-level security",
  "plate math · kg",
  "the judge",
];

/** Status board phrases. Padded to 12 tiles by SplitFlapText's `padTo`. */
const BOARD = ["BLAZE CORE", "RING ONLINE", "STEP FORWARD"];

type Phase = "boot" | "exit" | "gone";

export function BootSplash() {
  const [phase, setPhase] = useState<Phase>("boot");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;

    // Browser tab: the CSS gate already hides the sheet, so this is only about
    // not leaving it (and its two animated children) mounted for the life of
    // the session. Dropped on the next tick rather than in the effect body,
    // which would be a cascading render.
    if (!standalone) {
      const drop = setTimeout(() => setPhase("gone"), 0);
      return () => clearTimeout(drop);
    }

    const mountedAt = performance.now();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let goneTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const lift = () => {
      if (done) return;
      done = true;
      setPhase("exit");
      goneTimer = setTimeout(() => setPhase("gone"), EXIT_MS);
    };

    // Serve out the remainder of the minimum, then lift.
    const settle = () => {
      if (done) return;
      settleTimer = setTimeout(
        lift,
        Math.max(0, MIN_VISIBLE_MS - (performance.now() - mountedAt)),
      );
    };

    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) =>
            window.addEventListener("load", () => resolve(), { once: true }),
          );
    // Fonts matter here: the wordmark is Anton and the log is Geist Mono, and
    // lifting mid-swap hands the user a page that reflows under them.
    const fonts = document.fonts?.ready?.catch(() => {}) ?? Promise.resolve();

    Promise.all([loaded, fonts]).then(settle);
    const ceiling = setTimeout(lift, MAX_VISIBLE_MS);

    return () => {
      done = true;
      clearTimeout(ceiling);
      clearTimeout(settleTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="hb-boot" data-phase={phase} aria-hidden="true">
      {/* Same manga texturing as the route loader, vignetted so it never
          competes with the meter. */}
      <div className="hb-boot__texture hb-speedlines" />
      <div className="hb-boot__texture hb-halftone" />
      <div aria-hidden className="hb-boot__kanji">
        力
      </div>

      <div className="hb-boot__frame">
        <span className="hb-boot__sigil">
          <Flame className="size-4" />
        </span>

        <h1 className="hb-shiny hb-boot__wordmark font-impact">HELL BLAZER</h1>

        {/* React Bits. Both resolve on hydration, which is the point: the
            static chrome above paints first, then the board starts clacking
            and the line resolves out of its blur as React takes over. */}
        <BlurText
          text="Train like a Kengan fighter"
          as="span"
          delay={70}
          stepDuration={0.28}
          className="hb-boot__tagline justify-center font-mono"
        />

        <div className="hb-boot__board">
          <SplitFlapText
            words={BOARD}
            padTo={12}
            fontSize="clamp(15px, 5.4vw, 23px)"
            cycleDelay={1300}
            flipsPerChar={6}
            tileColor="var(--color-surface-2)"
          />
        </div>

        {/* Load meter + percentage: CSS only, so it climbs from frame one. */}
        <div className="hb-boot__meter">
          <span className="hb-boot__meter-fill" />
        </div>
        <div className="hb-boot__readout font-mono">
          <span className="hb-boot__pct" />
          <span className="hb-boot__readout-label">loading the bar</span>
        </div>

        <ul className="hb-boot__log font-mono">
          {BOOT_LOG.map((line, i) => (
            <li
              key={line}
              className="hb-boot__log-line"
              style={{ animationDelay: `${0.18 + i * 0.22}s` }}
            >
              <span className="hb-boot__log-ok">ok</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="hb-boot__foot font-mono">Kengan Association</div>
    </div>
  );
}

export default BootSplash;
