"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

/** Coming back to the app re-registers at most this often (APNs rotates tokens rarely). */
const REFRESH_EVERY_MS = 60 * 60 * 1000;

/**
 * iOS app only, mounted once in the signed-in layout. Opens the page a tapped
 * notification points at, and keeps this phone's push token fresh: on
 * opening, and on coming back to the app (iOS Settings may have changed
 * whether alerts are allowed, or a registration may have failed offline).
 * Renders nothing and does nothing on the website.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let removeTap: (() => void) | undefined;
    let cancelled = false;
    let refreshedAt = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - refreshedAt < REFRESH_EVERY_MS) return;
      refreshedAt = Date.now();
      void import("@/lib/native-push").then(({ refreshNativePush }) => refreshNativePush()).catch(() => {});
    };
    const onOnline = () => {
      refreshedAt = Date.now();
      void import("@/lib/native-push").then(({ refreshNativePush }) => refreshNativePush()).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    void (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const handle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const url = (action.notification.data as { url?: unknown } | undefined)?.url;
        // Same-site paths only.
        if (typeof url === "string" && /^\/(?![/\\])/.test(url)) router.push(url);
      });
      if (cancelled) void handle.remove();
      else removeTap = () => void handle.remove();

      const { refreshNativePush } = await import("@/lib/native-push");
      await refreshNativePush().catch(() => {});
    })().catch(() => {
      // An app build without push: there's nothing to route or refresh.
    });

    return () => {
      cancelled = true;
      removeTap?.();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
