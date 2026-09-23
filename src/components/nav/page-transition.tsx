"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const ENTER_EXIT = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "hb-page",
};

/**
 * Animates route changes with the browser's View Transitions API. Keyed on
 * the pathname, so every navigation exits the old page and enters the new
 * one. Links into a detail pass `transitionTypes={["nav-forward"]}` and slide
 * forward; links back out pass `nav-back`; everything else (tab to tab, the
 * browser's back button) crossfades with a short rise. Query-param changes
 * keep the key, so switching Progress tabs doesn't replay it. The nav chrome
 * carries its own view-transition names and stays put (globals.css).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter={ENTER_EXIT} exit={ENTER_EXIT} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
