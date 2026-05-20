// Minimal service worker: caches the app shell so JARVIS installs and opens
// instantly. Live data (the briefing API) is always fetched fresh from network.

const CACHE = "jarvis-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache the live briefing/health API — always go to network.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ ok: false, error: "offline" }), {
        headers: { "content-type": "application/json" },
      })
    ));
    return;
  }

  // Cache-first for the shell, with network fallback.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
