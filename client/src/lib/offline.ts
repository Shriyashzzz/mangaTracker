// Whether the app has a connection, and whether what's on screen is the
// copy the service worker kept (public/sw.js) rather than a fresh answer.
// The offline bar (components/offlineBar) says both.
import { create } from "zustand";

// the cache the service worker keeps the shelf's answers in. Kept in step
// with public/sw.js DATA
export const OFFLINE_DATA_CACHE = "data-v1";
// the header the service worker puts on a kept answer: when it was kept
const SAVED_AT_HEADER = "x-saved-at";

type OfflineState = {
  online: boolean;
  // when the copy on screen was kept; null while answers are fresh
  savedAt: number | null;
};

export const useOffline = create<OfflineState>()(() => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  savedAt: null,
}));

// no connection at all, as the browser knows it
export const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

// a request that never reached the server (fetch rejects with a TypeError)
export const isNetworkError = (e: unknown) => e instanceof TypeError;

export function watchConnection() {
  const update = () => useOffline.setState({ online: navigator.onLine });
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
}

// every API answer passes here: a kept copy says when it was kept; a fresh
// one means the copy on screen is current again
export function noteAnswer(res: Response) {
  const savedAt = Number(res.headers.get(SAVED_AT_HEADER));
  if (savedAt) return useOffline.setState({ savedAt });
  if (!res.ok) return;
  // the server answering again after a spell of kept copies: the signal's
  // back even if the browser never said so (a weak one never goes
  // "offline"), so changes made meanwhile can go (lib/offlineChanges.ts)
  const wasKept = useOffline.getState().savedAt != null;
  useOffline.setState({ savedAt: null });
  if (wasKept) window.dispatchEvent(new Event(CONNECTION_BACK));
}

// said when the server answers fresh after kept copies
export const CONNECTION_BACK = "connectionback";

// what a change gets when there's no connection to send it on (the few
// that can wait, lib/offlineChanges.ts, never come here)
export const offlineAnswer = () =>
  new Response(
    JSON.stringify({
      error: [{ msg: "You're offline, so that didn't save." }],
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );

// The shelf this browser kept, gone: on signing out, and before someone
// else signs in, so nobody's shelf stays behind on a shared computer
export async function forgetKeptShelf() {
  // (only on https and localhost: a plain http page has no caches at all)
  await globalThis.caches?.delete(OFFLINE_DATA_CACHE).catch(() => false);
  useOffline.setState({ savedAt: null });
}
