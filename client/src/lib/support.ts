// Asking for support, without being a pest. Kenji only peeks after someone has
// clicked through to a store, so they've already got something from the site: at
// most twice, months apart, and never again once they close it or use the link.
// Never on someone's first day here. The rule is lib/supportRule.ts; this
// keeps what's remembered, in this browser, so a person might see it once
// per device.
import { readLocal, writeLocal } from "./prefs";
import { canShow, withFirstVisit, type PeekState } from "./supportRule";

export const SUPPORT_URL = "https://ko-fi.com/shriyashzzz";

const KEY = "supportPeek";
// set by store/auth.ts when someone signs in: a regular, not a stranger
const SIGNED_IN_KEY = "signedInBefore";

// what's remembered, with this browser's first visit on record: written the
// first time the site is opened here, so the day is counted from then
const read = (): PeekState => {
  let state: PeekState = {};
  try {
    state = JSON.parse(readLocal(KEY) ?? "{}") as PeekState;
  } catch {
    // unreadable: as if nothing were remembered
  }
  if (state.firstSeenAt != null) return state;
  const signedInBefore = readLocal(SIGNED_IN_KEY) === "yes";
  const dated = withFirstVisit(state, Date.now(), signedInBefore);
  write(dated);
  return dated;
};
const write = (state: PeekState) => writeLocal(KEY, JSON.stringify(state));

// a visit: the site was opened in this browser. Called as the page frame
// loads, so a first visit is on record before any store is clicked
export const noteVisit = () => void read();

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
export const stopAsking = () =>
  write({ ...read(), pending: false, done: true });
