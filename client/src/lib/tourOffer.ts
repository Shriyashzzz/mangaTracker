// Kenji offers the tour once, to new accounts: signing up leaves a note, and
// taking the tour (from anywhere) or saying "Not now" settles it. Kept in this
// browser, so people who had an account before this never get asked, and
// someone who signs up on a laptop isn't asked again on their phone
import { readLocal, writeLocal } from "./prefs";

const OFFER_KEY = "offerTour";
const DONE_KEY = "tourDone";

export const offerTour = () => writeLocal(OFFER_KEY, "yes");
export const markTourDone = () => writeLocal(DONE_KEY, "yes");
export const shouldOfferTour = () =>
  readLocal(OFFER_KEY) === "yes" && readLocal(DONE_KEY) !== "yes";
