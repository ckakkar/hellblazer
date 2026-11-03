"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

/** How often one tab is checked. A prefetch of a page that's still fresh is a no-op. */
const TICK_MS = 5_000;

/** Where the tab bar shows (it's `md:hidden`). */
const TAB_BAR = "(max-width: 743.98px)";

/** The logger: mid-workout, the connection is the sets'. */
const LOGGER = /^\/log\/[^/]+$/;

/**
 * Keeps the tab bar's pages warm, so a tap shows one at once. The tabs'
 * links don't prefetch themselves: every save that revalidates (nearly all
 * of them) drops the client's copies, and links that prefetch fetched every
 * tab again at once, each a whole page read from the database. Over a gym's
 * signal that was a burst of five pages behind every tap. Here one tab is
 * fetched again per tick, only once its copy has lapsed or been dropped, so
 * the work spreads out; never the page already on screen, and never while a
 * workout is being logged. Only while the app is in front, online, and where
 * the tab bar is on screen: the desktop sidebar shows the loader instead.
 */
export function useWarmTabs(hrefs: readonly string[]) {
  const router = useRouter();
  const pathname = usePathname();
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  }, [pathname]);
  const key = hrefs.join(" ");
  useEffect(() => {
    const list = key.split(" ").filter(Boolean);
    let next = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!window.matchMedia(TAB_BAR).matches) return;
      // Offline there's nothing to fetch; with Save Data on, the lifter
      // asked for less of exactly this.
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      if (!navigator.onLine || saveData) return;
      const path = here.current;
      if (LOGGER.test(path)) return;
      for (let i = 0; i < list.length; i++) {
        const href = list[(next + i) % list.length];
        if (href === path) continue;
        next = (next + i + 1) % list.length;
        router.prefetch(href, { kind: PrefetchKind.FULL });
        return;
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [key, router]);
}
