/* Offline shell for the GG static app. */
const CACHE = "gg-app-v3";
const SHELL = [
  "./",
  "./index.html",
  "./Background.jpg",
  "./Icon.png",
  "./manifest.webmanifest",
  "./fut-data.js",
  "./coach-art.js",
  "./hi-cards.js",
  "./js/01-data.js",
  "./js/02-helpers.js",
  "./js/03-state.js",
  "./js/04-card-render.js",
  "./js/05-screens.js",
  "./js/06-game-flow.js",
  "./js/07-game-end.js",
  "./js/08-simulation.js",
  "./js/09-ai-opponent.js",
  "./js/10-network.js",
  "./js/11-navigation-boot.js",
  "./js/12-assets.js",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function cacheKey(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin ? new Request(url.origin + url.pathname) : request;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try { await cache.put(cacheKey(request), response.clone()) } catch (_) { }
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function navigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("navigation timeout")), 5000))
    ]);
    if (response && response.ok) {
      try { await cache.put(cacheKey(request), response.clone()) } catch (_) { }
    }
    return response;
  } catch (error) {
    return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
  }
}

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
  } catch (_) { }
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    } catch (_) { }
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
    return;
  }
  if (url.origin === self.location.origin) {
    const isImage = request.destination === "image" || /\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);
    event.respondWith(isImage ? cacheFirst(request) : networkFirst(request));
    return;
  }
  /* Fonts and the PeerJS CDN: cached after first use, not required offline. */
  event.respondWith(cacheFirst(request));
});
