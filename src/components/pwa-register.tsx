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

    let reloading = false;
    const adoptFreshWorker = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", adoptFreshWorker);

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
    };
  }, []);
  return null;
}
