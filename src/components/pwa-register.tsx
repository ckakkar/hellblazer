"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Registers production offline/push support without letting dev chunks go stale. */
export function PwaRegister() {
  const path = usePathname();
  // A fresh worker took over while it wasn't a moment to reload.
  const waiting = useRef(false);
  const busy = () =>
    window.location.pathname.startsWith("/log/") ||
    Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable='true']"));

  // Moving to another page is the moment: the lifter's leaving what they
  // were doing anyway. Leaving a workout for Home picks up the new deploy.
  useEffect(() => {
    if (waiting.current && !busy()) window.location.reload();
  }, [path]);

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
    // Never mid-workout, and not with a field being typed in: locking the
    // phone between sets isn't a moment to reload a workout either. It waits
    // for the next move to another page (above), and until then the old
    // page keeps working against the new deploy, as it did before.
    const hadController = Boolean(navigator.serviceWorker.controller);
    const adoptFreshWorker = () => {
      if (!hadController || waiting.current) return;
      if (busy()) waiting.current = true;
      else window.location.reload();
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
