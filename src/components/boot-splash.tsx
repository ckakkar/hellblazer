"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

/**
 * What the installed app shows while it wakes up.
 *
 * iOS paints a static launch image over a cold PWA start (see `startupImage`
 * in the root layout), then drops it the moment the document paints, which on
 * a phone is before React has hydrated. This holds the identical frame (true
 * black, the flame at 44pt, centred; scripts/generate-splash.mjs draws the
 * same thing) so the hand-off is invisible, then fades as soon as the app is
 * live. No minimum hold: a warm start should feel instant.
 *
 * Browser tabs never see it: `.hb-boot` is `display: none` outside
 * `display-mode: standalone`. If hydration never happens, the CSS failsafe on
 * `.hb-boot[data-phase="boot"]` lifts it after 6s.
 */

/** Matches the .hb-boot opacity transition in globals.css. */
const EXIT_MS = 260;

type Phase = "boot" | "exit" | "gone";

export function BootSplash() {
  const [phase, setPhase] = useState<Phase>("boot");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    // Next tick rather than in the effect body, which would be a cascading
    // render. In a browser tab this just unmounts the hidden sheet.
    const lift = setTimeout(() => setPhase(standalone ? "exit" : "gone"), 0);
    const gone = standalone
      ? setTimeout(() => setPhase("gone"), EXIT_MS)
      : undefined;
    return () => {
      clearTimeout(lift);
      if (gone) clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="hb-boot" data-phase={phase} aria-hidden="true">
      <Flame className="size-11 text-accent" strokeWidth={2} />
    </div>
  );
}
