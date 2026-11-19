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

// Offline as the screen sees it: no connection, or the copy on screen is the
// kept one (a signal too weak to answer). What needs a live answer (prices,
// the New tab's checks) is greyed out then: offlineLink below
export const useIsOffline = () =>
  useOffline((s) => !s.online || s.savedAt != null);

// A link, tab or button that needs a connection: greyed while offline
// (index.css [data-offline]), and a tap says why with a note by the finger
// (components/offlineBar/OfflineNudge.tsx), since phones have no hover text.
// Spread last, so its onClick wins
export const NEEDS_CONNECTION = "needsconnection";
type Tap = {
  preventDefault: () => void;
  stopPropagation: () => void;
  currentTarget: EventTarget;
};
export const offlineLink = (offline: boolean) =>
  offline
    ? {
        "aria-disabled": true,
        "data-offline": true,
        title: "Needs a connection",
        onClick: (e: Tap) => {
          e.preventDefault();
          e.stopPropagation();
          // the note centres on the control (a tap or a key press alike)
          const box = (e.currentTarget as Element).getBoundingClientRect();
          window.dispatchEvent(
            new CustomEvent(NEEDS_CONNECTION, { detail: box }),
          );
        },
      }
    : {};

// Pages that need a connection, by where their address starts: opened
// offline, they say so (components/offlineBar/NeedsConnection.tsx)
const ONLINE_PAGES = [
  "/add",
  "/import",
  "/update/",
  "/to-buy",
  "/prices",
  "/deals",
  "/u/",
  "/calendar",
  "/new-releases",
  "/after-the-anime",
  "/series",
  "/reviews",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/email/",
];
export const needsConnection = (path: string) =>
  ONLINE_PAGES.some((start) => path.startsWith(start));

export const useOffline = create<OfflineState>()(() => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  savedAt: null,
}));

// what a failed change says with no connection, everywhere
export const OFFLINE_SAID = "You're offline. Try again when you're back.";
// a failure message, unless there's no connection: then OFFLINE_SAID
export const orOffline = (said: string) => (isOffline() ? OFFLINE_SAID : said);

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
      error: [{ msg: OFFLINE_SAID }],
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
