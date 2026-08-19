/* KYProfit service worker
 * Bump CACHE_VERSION on every deploy so returning users pick up the new build.
 *
 * Strategy:
 * - Navigations (loading the app itself): network-first, so a genuinely new
 *   deploy is picked up quickly when online, falling back to the cached
 *   shell when offline.
 * - Everything else (CSS, JS, icons, manifest): cache-first, refreshed in
 *   the background — instant loads, works offline, still stays current.
 *
 * Note: Vite's built JS/CSS files get content-hashed names on every build
 * (e.g. index-a1b2c3.js), so we don't hardcode them into PRECACHE_URLS below.
 * They're cached automatically the first time they're fetched, via the
 * "everything else" branch in the fetch handler — same end result, just
 * warmed on first visit instead of at install time.
 */
var CACHE_VERSION = "kyprofit-v1.0.0";
var PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.svg",
  "./favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API calls: never cache, never intercept — always go straight to network.
  if (url.pathname.indexOf("/api/") === 0) {
    return;
  }

  // Navigations: try network first so a new deploy is seen quickly, fall
  // back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put("./index.html", copy); });
          return res;
        })
        .catch(function () {
          return caches.match("./index.html");
        })
    );
    return;
  }

  // Everything else: cache-first, refresh cache in the background.
  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });

      return cached || networkFetch;
    })
  );
});
