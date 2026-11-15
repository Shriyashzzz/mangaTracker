// How many times someone without an account has come to a shared shelf, so
// the page can say the right thing: a hint that a series opens on the first
// visit, and nothing extra after that. A visit is a browser session, so moving around doesn't
// count twice.
import { readLocal, writeLocal } from "./prefs";

const VISITS_KEY = "shareVisits";
const COUNTED_KEY = "shareVisitCounted";

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
    // blocked storage: each page load counts, which only means the offer
    // stops sooner
  }
  writeLocal(VISITS_KEY, String(before + 1));
  return before + 1;
}
