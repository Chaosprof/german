/* Artikel Blitz service worker: precache the app shell, then runtime-cache
   everything the app requests (data JSON, deck manifests, runner assets). */
const CACHE_NAME = "artikel-blitz-v40";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./berlin-runner.html",
  "./data/berlin-runner-decks.js",
  "./assets/models/berlin-runner-hero-v12.glb?rev=31",
  "./assets/img/berlin-street-art-atlas-v1-1024.png",
  "./assets/img/berlin-skyline-strip.png",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // Cache entries independently: one optional image failing must not discard
    // the already-fetched app shell and prevent the worker from installing.
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => null)))
    )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first with cached fallback (keeps the app current
  // while still loading instantly from cache when offline).
  if (request.mode === "navigate") {
    event.respondWith(
      // Do not leave an offline launch staring at a pending network socket.
      // Race the update against a short timeout, then fall back to the shell.
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error("navigation timeout")), 2500))
      ])
        .then((response) => {
          const copy = response.clone();
          return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            .then(() => response, () => response);
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Everything else: stale-while-revalidate so repeated runs are instant and
  // updates land silently in the background.
  const fetched = fetch(request).then((response) => {
    if (!response || !response.ok) return response;
    const copy = response.clone();
    return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      .then(() => response, () => response);
  });
  // Keep stale-while-revalidate alive after a cached response returns.
  event.waitUntil(fetched.then(() => undefined, () => undefined));
  event.respondWith(caches.match(request).then((cached) => cached || fetched));
});
