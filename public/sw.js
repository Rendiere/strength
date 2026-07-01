// Strength PWA service worker — cache the app shell, network-first for the API.
const CACHE = "strength-v1";
const SHELL = ["/", "/index.html", "/app.js", "/styles.css", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    // Network-first; the app handles offline by queueing, so just pass through.
    return; // let the browser handle it (no cache for API)
  }
  // App shell: cache-first, fall back to network.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
