"use client";

import { useEffect } from "react";
import { resendDroppedActions } from "@/lib/action-retry";

// Before anything can call a server action: this mounts on every page.
resendDroppedActions();

/**
 * Registers production offline/push support without letting dev chunks go stale.
 *
 * It never reloads the page. The worker caches only media and the offline
 * page (public/sw.js); pages, JS and CSS always come from the network, so a
 * new worker taking over changes nothing the page runs. It used to reload on
 * that takeover "to match the deploy", and iOS's web view installs the same
 * worker again on every full load: each reload set off the next, about once
 * a second, until the app was killed. Mid-workout the reload waited, so it
 * went off the moment the lifter left the workout.
 */
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

    // Once. A registered worker is kept up to date by the browser itself, on
    // navigations; asking again on every load only adds installs.
    const register = () => {
      void navigator.serviceWorker
        .getRegistration("/")
        .then((existing) => existing ?? navigator.serviceWorker.register("/sw.js"))
        .catch(() => {
          // Registration failing (e.g. private mode) must never break the app.
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
