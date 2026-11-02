// Asking for support, without being a pest. Kenji only peeks after someone has
// clicked through to a store, so they've already got something from the site: at
// most twice, months apart, and never again once they close it or use the link.
// Remembered in this browser, so a person might see it once per device.
import { readLocal, writeLocal } from "./prefs";

export const SUPPORT_URL = "https://ko-fi.com/shriyashzzz";

const KEY = "supportPeek";
const MAX_SHOWS = 2;
export const SHOW_AGAIN_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

type PeekState = {
  // a store click is waiting for them to come back
  pending?: boolean;
  shows?: number;
  lastShownAt?: number;
  done?: boolean;
};

const read = (): PeekState => {
  try {
    return JSON.parse(readLocal(KEY) ?? "{}") as PeekState;
  } catch {
    return {};
  }
};
const write = (state: PeekState) => writeLocal(KEY, JSON.stringify(state));

const canShow = (state: PeekState, now: number) =>
  !state.done &&
  (state.shows ?? 0) < MAX_SHOWS &&
  now - (state.lastShownAt ?? 0) >= SHOW_AGAIN_AFTER_MS;

// only counts if it could lead to a peek: a click months before one is allowed
// shouldn't bring him out on some unrelated visit
export const noteStoreClick = () => {
  const state = read();
  if (canShow(state, Date.now())) write({ ...state, pending: true });
};

export const readyToPeek = () => {
  const state = read();
  return Boolean(state.pending) && canShow(state, Date.now());
};

export const markPeekShown = () => {
  const state = read();
  write({
    ...state,
    pending: false,
    shows: (state.shows ?? 0) + 1,
    lastShownAt: Date.now(),
  });
};

// they've answered, by closing it or using the link
export const stopAsking = () => write({ ...read(), pending: false, done: true });
