"use client";

import { useEffect } from "react";

/** Registers production offline/push support without letting dev chunks go stale. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Turbopack reuses stable development chunk URLs. A service worker caching
    // those URLs can pair fresh server HTML with an older client component and
    // make hydration impossible. Development therefore actively removes any
    // worker/cache left behind by an installed production build.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("static-hb-") || key.startsWith("runtime-hb-"))
              .map((key) => caches.delete(key)),
          ),
        );
      }
      return;
    }

    // Reload only when a new worker replaces an old one, so the page matches
    // the deploy it now talks to. On a first visit there is no old worker:
    // the fresh one claiming the page also fires controllerchange, and
    // reloading then would just flash the page (or drop a half-filled form).
    // Not mid-workout, and not with a field being typed in: then it waits
    // until the page is out of sight (the phone locked, another app), where
    // a reload interrupts nothing.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let waiting = false;
    const busy = () =>
      window.location.pathname.startsWith("/log/") ||
      Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable='true']"));
    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const adoptFreshWorker = () => {
      if (!hadController || reloading) return;
      if (busy()) waiting = true;
      else reload();
    };
    const reloadOutOfSight = () => {
      if (waiting && document.visibilityState === "hidden") reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", adoptFreshWorker);
    document.addEventListener("visibilitychange", reloadOutOfSight);

    const register = () => {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        void registration.update();
      }).catch(() => {
        // Registration failing (e.g. private mode) must never break the app.
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", adoptFreshWorker);
      document.removeEventListener("visibilitychange", reloadOutOfSight);
    };
  }, []);
  return null;
}
