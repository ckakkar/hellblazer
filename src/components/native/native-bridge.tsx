"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

/**
 * iOS app only, mounted once in the signed-in layout. Opens the page a tapped
 * notification points at, and keeps this phone's push token fresh. Renders
 * nothing and does nothing on the website.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let removeTap: (() => void) | undefined;
    let cancelled = false;

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
    })();

    return () => {
      cancelled = true;
      removeTap?.();
    };
  }, [router]);

  return null;
}
