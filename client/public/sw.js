// The service worker: what lets the site be installed, open with no signal,
// and send changes made offline. Plain browser code, no library.
//
//   pages        asked of the network first, so nobody sees an old version.
//                With no network: the app itself, if this browser has a
//                signed-in shelf kept (it opens on that shelf); otherwise
//                the offline page
//   /assets/     the build's files. Every one of them is kept, from the list
//                the build writes (asset-manifest.json), so any page opens
//                offline; their names change each deploy, so a kept one is
//                never out of date. Used before the network
//   the shelf    a few answers the shelf needs (KEPT below): asked of the
//                network first and a copy kept, given back with no network,
//                marked with when they were kept. Cleared by the app when
//                someone signs out (client lib/offline.ts)
//   the rest     left alone: prices, sign-in, every change. Nothing else of
//                the API is ever kept
//
// Changes made offline wait in the browser's database (client
// lib/offlineChanges.ts); on Android "send-changes" sends them when the
// signal's back, even with the app closed.
//
// A change to how this works: raise VERSION, and old caches are cleared.
const VERSION = 4;
const SHELL = `shell-v${VERSION}`;
const ASSETS = `assets-v${VERSION}`;
// kept in step with client lib/offline.ts OFFLINE_DATA_CACHE
const DATA = "data-v1";
const OFFLINE = "/offline.html";
// the app's page, kept from the last visit, for opening it offline
const APP = "/app-page";
const SHELL_FILES = [OFFLINE, "/favicon.svg"];
// the answers kept for the shelf: who's signed in, their shelf, a series,
// its books, their settings, account and To buy list
const KEPT =
  /^\/api\/(auth\/me|manga|manga\/\d+|manga\/\d+\/books|prefs|account|to-buy)$/;
// the header on a kept answer: when it was kept (client lib/offline.ts)
const SAVED_AT = "x-saved-at";

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
            .filter((name) => ![SHELL, ASSETS, DATA].includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => keepAllAssets()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // another site (covers, stores, fonts): never ours to keep
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(page(request, url));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(fromCacheFirst(request));
  } else if (KEPT.test(url.pathname)) {
    event.respondWith(keptAnswer(request, url));
  }
});

// ---------- pages ----------

async function page(request, url) {
  try {
    const response = await fetch(request);
    // the app's own page, for next time there's no signal. (A price page
    // has its own words in it: never kept as the app's)
    const isApp =
      response.ok &&
      (response.headers.get("content-type") ?? "").includes("text/html") &&
      !url.pathname.startsWith("/prices/");
    if (isApp) {
      const shell = await caches.open(SHELL);
      await shell.put(APP, response.clone());
      void keepAllAssets();
    }
    return response;
  } catch {
    // no signal: the app, if there's a signed-in shelf to show in it
    const data = await caches.open(DATA);
    const hasShelf = Boolean(await data.match("/api/manga"));
    const app = hasShelf ? await caches.match(APP) : undefined;
    return app ?? (await caches.match(OFFLINE)) ?? Response.error();
  }
}

// ---------- the build's files ----------

async function fromCacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// Every file the build lists, kept; any the build doesn't list any more,
// let go. At most every ten minutes
let keptAssetsAt = 0;
async function keepAllAssets() {
  if (Date.now() - keptAssetsAt < 10 * 60_000) return;
  keptAssetsAt = Date.now();
  try {
    const listing = await fetch("/asset-manifest.json", { cache: "no-store" });
    if (!listing.ok) return;
    const files = new Set();
    for (const entry of Object.values(await listing.json())) {
      files.add(`/${entry.file}`);
      for (const css of entry.css ?? []) files.add(`/${css}`);
      for (const asset of entry.assets ?? []) files.add(`/${asset}`);
    }
    const cache = await caches.open(ASSETS);
    const have = new Set(
      (await cache.keys()).map((r) => new URL(r.url).pathname),
    );
    for (const file of files) if (!have.has(file)) await cache.add(file);
    for (const old of have) if (!files.has(old)) await cache.delete(old);
  } catch {
    // tried again on the next visit
    keptAssetsAt = 0;
  }
}

// ---------- the shelf's answers ----------

async function keptAnswer(request, url) {
  const cache = await caches.open(DATA);
  // one copy of each, whatever country it was asked for
  const key = url.pathname;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set(SAVED_AT, String(Date.now()));
      const copy = new Response(await response.clone().blob(), {
        status: response.status,
        headers,
      });
      await cache.put(key, copy);
    } else if (response.status === 401) {
      // signed out (on another device, or the session ran out): their
      // shelf isn't kept here any more
      await caches.delete(DATA);
    }
    return response;
  } catch {
    const kept = await cache.match(key);
    return (
      kept ??
      new Response(JSON.stringify({ error: [{ msg: "You're offline." }] }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}

// ---------- alerts (server src/push/, client lib/alerts.ts) ----------

// an alert from the server: shown as the phone's own notification, with
// the page it opens
self.addEventListener("push", (event) => {
  let alert = {};
  try {
    alert = event.data ? event.data.json() : {};
  } catch {
    alert = { title: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(alert.title || "Manga Tracker", {
      body: alert.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: alert.tag,
      data: { url: alert.url || "/shelf" },
    }),
  );
});

// tapped: the app, on that page. An open window of ours is used if there's
// one; a link from elsewhere is never followed
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const asked = new URL(
    event.notification.data?.url || "/shelf",
    self.location.origin,
  );
  const url =
    asked.origin === self.location.origin
      ? asked.href
      : `${self.location.origin}/shelf`;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((open) => {
        const ours = open.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (ours)
          return ours.navigate(url).then((client) => (client ?? ours).focus());
        return self.clients.openWindow(url);
      }),
  );
});

// ---------- changes made offline (client lib/offlineChanges.ts) ----------

self.addEventListener("sync", (event) => {
  if (event.tag === "send-changes") event.waitUntil(sendChanges());
});

// the browser's database, as the app opens it. Kept in step with
// client lib/offlineChanges.ts
function openChanges() {
  return new Promise((resolve, reject) => {
    const asked = indexedDB.open("manga-tracker", 1);
    asked.onupgradeneeded = () =>
      asked.result.createObjectStore("changes", { keyPath: "key" });
    asked.onsuccess = () => resolve(asked.result);
    asked.onerror = () => reject(asked.error);
  });
}
function inChanges(db, mode, act) {
  return new Promise((resolve, reject) => {
    const asked = act(db.transaction("changes", mode).objectStore("changes"));
    asked.onsuccess = () => resolve(asked.result);
    asked.onerror = () => reject(asked.error);
  });
}

// a change as the server takes it (client lib/offlineChanges.ts toSend)
const toSend = (change) =>
  change.kind === "owned"
    ? {
        kind: change.kind,
        mangaId: change.mangaId,
        started: change.started,
        ended: change.ended,
      }
    : {
        kind: change.kind,
        mangaId: change.mangaId,
        from: change.from,
        to: change.to,
      };

// The same send as the app's own, for when the app is closed: each change
// once, never one changed again while it was on its way. A failure throws,
// and the browser tries again later
async function sendChanges() {
  // the app is open: it sends them itself, as the signal comes back
  const open = await self.clients.matchAll({ type: "window" });
  if (open.length) return;
  const db = await openChanges();
  try {
    const changes = await inChanges(db, "readonly", (s) => s.getAll());
    if (!changes.length) return;
    const response = await fetch("/api/manga/offline-changes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: changes.map(toSend) }),
    });
    // signed out: kept for when they sign in
    if (response.status === 401) return;
    if (!response.ok) throw new Error(`answered ${response.status}`);
    for (const change of changes) {
      const now = await inChanges(db, "readonly", (s) => s.get(change.key));
      if (now?.at === change.at)
        await inChanges(db, "readwrite", (s) => s.delete(change.key));
    }
    for (const client of await self.clients.matchAll())
      client.postMessage("changes-sent");
  } finally {
    db.close();
  }
}
