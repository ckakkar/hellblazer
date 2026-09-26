/* Fatty service worker: offline shell + web push.
   Hand-rolled (no build step) so it stays framework-agnostic. */
// Bump to drop every cached file at once (e.g. a change to this file's
// caching rules). Replacing a single image doesn't need it: media revalidates.
const VERSION = "hb-v4";
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/icon.png",
  "/apple-icon.png",
  "/art/fighters/ohma.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Never touch mutations or cross-origin (Supabase, Google OAuth, etc.).
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Next build output. Production filenames are hashed, while dev
  // chunk URLs are stable; either way the framework owns their lifecycle.
  if (url.pathname.startsWith("/_next/")) return;

  // Page loads are network-only with the explicit offline document as fallback.
  // Caching authenticated HTML risks replaying another point-in-time session.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Authored media and fonts: stale-while-revalidate. A cached copy answers
  // at once (and offline), and a fresh one is fetched behind it, so an asset
  // replaced under the same URL shows on the next visit without bumping
  // VERSION. JS and CSS always stay on the network so a deployment can never
  // mix two application revisions.
  const isStatic = /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/.test(url.pathname);
  if (isStatic) {
    const cacheName = PRECACHE.includes(url.pathname) ? STATIC_CACHE : RUNTIME_CACHE;
    const fresh = fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches
            .open(cacheName)
            .then((c) => c.put(req, copy))
            .then(() => cacheName === RUNTIME_CACHE && trim(RUNTIME_CACHE, RUNTIME_MAX));
        }
        return res;
      })
      .catch(() => undefined);
    event.respondWith(
      caches.match(req).then((cached) => cached || fresh.then((res) => res || Response.error())),
    );
    // Keep the worker alive until the background refresh is stored.
    event.waitUntil(fresh);
  }
});

/** Oldest-first eviction, so the media cache can't grow without bound. */
const RUNTIME_MAX = 150;
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

/* ── Web Push ─────────────────────────────────────────────────────────── */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Fatty";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: data.tag || "hell-blazer",
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
