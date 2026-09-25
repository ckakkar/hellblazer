"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";
import { withNative } from "@/lib/native-plugins";
import { isPushedRoute } from "@/lib/native-routes";

declare global {
  interface Window {
    /** Called by the iOS app (HellBlazerViewController.open) to navigate in place. */
    __hbNavigate?: (path: string) => boolean;
  }
}

/**
 * The iOS app's hooks into every page, signed in or not; mounted in the root
 * layout, and inert on the website.
 *
 * - Marks <html data-app> so app-only CSS applies (no text selection on UI).
 * - Tells the app the page is interactive, which lifts the launch screen.
 * - Lets quick actions, Siri, universal links and Live Activity taps navigate
 *   in place instead of reloading the site.
 * - Turns the edge swipe back on for pushed pages only.
 */
export function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.app = "ios";
    withNative((api) => api.ready());
    window.__hbNavigate = (path: string) => {
      if (!/^\/(?![/\\])/.test(path)) return false;
      router.push(path);
      return true;
    };
    return () => {
      delete window.__hbNavigate;
    };
  }, [router]);

  useEffect(() => {
    if (!isNativeApp()) return;
    withNative((api) => api.setBackGesture({ enabled: isPushedRoute(pathname) }));
  }, [pathname]);

  return null;
}
