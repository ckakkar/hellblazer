"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Never fires — we only want the server/client snapshot split. */
const noopSubscribe = () => () => {};

/**
 * Renders children into <body>.
 *
 * `position: fixed` is resolved against the nearest ancestor carrying a
 * transform, filter or backdrop-filter — not reliably the viewport. Several
 * wrappers in this app qualify (page settle-in animations, .hb-glass chrome),
 * and WebKit holds onto that containment more stubbornly than Blink, so a
 * full-screen overlay rendered inline can anchor to the page instead of the
 * screen and open far below the fold. Overlays go through here so no ancestor
 * can ever form their containing block.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  return createPortal(children, document.body);
}
