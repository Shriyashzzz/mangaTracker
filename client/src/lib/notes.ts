// Kenji's notes take turns: one a visit (this browser tab), and none of the
// others while the tour is still on offer, since that one matters most to
// someone new. Each note asks noteFree before it shows and claims it when it
// does
import { shouldOfferTour } from "./tourOffer";

const KEY = "noteThisVisit";

type NoteName = "tour" | "release" | "view" | "support" | "weekly";

const shownThisVisit = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const noteFree = (name: NoteName) => {
  // The weekly email question is only for Google readers, who are never
  // offered the tour: one on offer is left over from another account here
  const waitsForTour = name !== "tour" && name !== "weekly";
  if (waitsForTour && shouldOfferTour()) return false;
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
