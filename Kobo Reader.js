/* Kobo Highlights service worker: keeps the app working offline.
   The page always loads fresh when online; GitHub API calls are never cached. */
const SHELL = "khl-shell-v2";
const FONTS = "khl-fonts-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => Promise.all(SHELL_FILES.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== FONTS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function pageNetworkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put("./index.html", response.clone());
    return response;
  } catch (err) {
    return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.hostname === "api.github.com") return;
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(pageNetworkFirst(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request, FONTS));
  }
});
