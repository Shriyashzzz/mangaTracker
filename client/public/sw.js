// The service worker: what lets the site be installed, and open when the
// signal drops. Plain browser code, no library. It does three things:
//
//   pages     always asked of the network first, so a reader never sees an
//             old version of the site. With no network at all, the offline
//             page is shown instead of the browser's own error
//   /assets/  the build's files (their names change every deploy, so a
//             saved one is never out of date): kept, and used before the
//             network, so the app opens without downloading them again
//   the rest  left alone, /api above all: the site server passes /api on to
//             the API (client/server.ts), and nothing about a shelf, a
//             price or a sign-in is ever kept here
//
// A change to how this works: raise VERSION, and old caches are cleared.
const VERSION = 1;
const SHELL = `shell-v${VERSION}`;
const ASSETS = `assets-v${VERSION}`;
// the offline page and what it shows
const OFFLINE = "/offline.html";
const SHELL_FILES = [OFFLINE, "/favicon.svg"];
// enough build files for a few deploys; the oldest go first
const MOST_ASSETS = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

// a new version takes over at once, and clears what older ones kept
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // another site (covers, stores, fonts), or the API: never ours to keep
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE).then((page) => page ?? Response.error()),
      ),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(fromCacheFirst(request));
  }
});

async function fromCacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    void trim(cache);
  }
  return response;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MOST_ASSETS)))
    await cache.delete(old);
}
