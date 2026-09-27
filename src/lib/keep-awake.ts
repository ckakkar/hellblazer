"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { withNative } from "@/lib/native-plugins";

/** Where the choice lives, per device. On unless turned off. */
const KEY = "hell-blazer:keep-awake";

export function keepAwakeOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setKeepAwake(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, "off");
  } catch {
    // Storage blocked: it stays on.
  }
}

/** Whether this device can hold the screen on at all. */
export function canKeepAwake(): boolean {
  return isNativeApp() || (typeof navigator !== "undefined" && "wakeLock" in navigator);
}

/**
 * Keeps the screen on while `active` (a live workout on screen), so the
 * phone doesn't lock between sets. In the iOS app that's the native switch;
 * on the web, the Screen Wake Lock API, taken again whenever the page comes
 * back, since the browser lets go of it when the page is hidden.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active || !keepAwakeOn()) return;
    if (isNativeApp()) {
      withNative((api) => api.keepAwake({ on: true }));
      return () => withNative((api) => api.keepAwake({ on: false }));
    }
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const take = async () => {
      if (done || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (done) void next.release();
        else lock = next;
      } catch {
        // Refused (low battery, say): the screen just sleeps as usual.
      }
    };
    const onVisible = () => void take();
    void take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
