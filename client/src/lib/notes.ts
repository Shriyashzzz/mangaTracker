// Kenji's notes take turns: one a visit (this browser tab), and none of the
// others while the tour is still on offer, since that one matters most to
// someone new. Each note asks noteFree before it shows and claims it when it
// does
import { shouldOfferTour } from "./tourOffer";

const KEY = "noteThisVisit";

type NoteName = "tour" | "release" | "view" | "support" | "share";

const shownThisVisit = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// a shared shelf's note is for visitors without an account, who are never
// offered the tour
export const noteFree = (name: NoteName) => {
  if (name !== "tour" && name !== "share" && shouldOfferTour()) return false;
  const shown = shownThisVisit();
  return !shown || shown === name;
};

export const claimNote = (name: NoteName) => {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    // storage can be blocked; notes just don't take turns then
  }
};
