// When Kenji may ask for a coffee (lib/support.ts keeps the state; this is
// the rule on its own, with no imports, so the server's Jest can test it).
//
// He never asks a first-time visitor. Someone has to have been here on an
// earlier day, then clicked through to a store on this one: they've come
// back, and got something from the site. Then at most twice, months apart,
// and never again once they close him or use the link.

export type PeekState = {
  // when this browser first opened the site
  firstSeenAt?: number;
  // a store click is waiting for them to come back
  pending?: boolean;
  shows?: number;
  lastShownAt?: number;
  done?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SHOWS = 2;
export const SHOW_AGAIN_AFTER_MS = 90 * DAY_MS;
// how long after their first visit before he may ask at all
export const NOT_ON_THE_FIRST_DAY_MS = DAY_MS;

// a first-time visitor: no first visit on record, or one within the day
export const isFirstVisit = (state: PeekState, now: number) =>
  state.firstSeenAt == null ||
  now - state.firstSeenAt < NOT_ON_THE_FIRST_DAY_MS;

export const canShow = (state: PeekState, now: number) =>
  !state.done &&
  !isFirstVisit(state, now) &&
  (state.shows ?? 0) < MAX_SHOWS &&
  now - (state.lastShownAt ?? 0) >= SHOW_AGAIN_AFTER_MS;

// The state with the first visit on record. A browser he has already asked,
// or been dismissed in, or that has signed in before, isn't new: its first
// visit is put in the past, so a regular isn't treated as a stranger the day
// this rule arrives. Anyone else starts their clock now
export function withFirstVisit(
  state: PeekState,
  now: number,
  hasSignedInBefore: boolean,
): PeekState {
  if (state.firstSeenAt != null) return state;
  // (a store click waiting, `pending`, proves nothing: it can be from the
  // first visit itself)
  const knownAlready = hasSignedInBefore || Boolean(state.shows || state.done);
  return { ...state, firstSeenAt: knownAlready ? 0 : now };
}
