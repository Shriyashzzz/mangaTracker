// Which of a series' found sets its page shows (no components here, so the
// box and the page can both use it).
import type { BoxSet } from "../../lib/types";

// the sets a series page shows: an omnibus listing is left out when the page
// lists the series' omnibus and deluxe books itself ("Other editions")
export const shownSets = (found: BoxSet[], editionsListed: boolean) =>
  editionsListed ? found.filter((s) => s.format !== "omnibus") : found;

// what the box is called: omnibus listings sit in it too when the page has
// no "Other editions" of its own to list them
export const setsTitle = (sets: BoxSet[]) =>
  sets.some((s) => s.format === "omnibus")
    ? "Box sets & omnibuses"
    : "Box sets";
