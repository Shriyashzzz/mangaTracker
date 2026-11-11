// Kenji's note on a shared shelf, for someone without an account: on their
// first three visits to shared shelves he says one thing each time (what the
// page is, then that they can have their own). Closing him settles it for
// good. A visit is a browser session, so moving around doesn't count twice
import { readLocal, writeLocal } from "./prefs";

const VISITS_KEY = "shareVisits";
const DONE_KEY = "sharePeekDone";
const COUNTED_KEY = "shareVisitCounted";
export const SHARE_PEEK_VISITS = 3;

const countedThisSession = () => {
  try {
    return sessionStorage.getItem(COUNTED_KEY) === "yes";
  } catch {
    return false;
  }
};

// this visit's number: 1 the first time, and so on
export function countShareVisit(): number {
  const before = Number(readLocal(VISITS_KEY)) || 0;
  if (countedThisSession()) return Math.max(before, 1);
  try {
    sessionStorage.setItem(COUNTED_KEY, "yes");
  } catch {
    // blocked storage: each page load counts, which only means fewer notes
  }
  writeLocal(VISITS_KEY, String(before + 1));
  return before + 1;
}

export const sharePeekDone = () => readLocal(DONE_KEY) === "yes";
export const settleSharePeek = () => writeLocal(DONE_KEY, "yes");

// which note this visit gets, if any
export const sharePeekFor = (visit: number) =>
  sharePeekDone() || visit < 1 || visit > SHARE_PEEK_VISITS ? null : visit;
