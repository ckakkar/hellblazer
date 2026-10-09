"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

/** How often to check. A prefetch of a page that's still fresh is a no-op. */
const TICK_MS = 10_000;

/**
 * The tab bar prefetches each tab's whole page, so a tap shows it at once.
 * Those copies lapse after `staleTimes.static` (next.config.ts), and Next only
 * fetches them again on the next navigation, so a tab tapped after a long
 * read, or mid-workout, would wait on the server with nothing on screen.
 * While the app is in front, this fetches any lapsed tab again.
 */
export function useWarmTabs(hrefs: readonly string[]) {
  const router = useRouter();
  const key = hrefs.join(" ");
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      for (const href of key.split(" ")) router.prefetch(href, { kind: PrefetchKind.FULL });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [key, router]);
}
