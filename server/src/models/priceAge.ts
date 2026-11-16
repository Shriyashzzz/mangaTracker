// How old a saved price can be and still be shown. One rule for the whole
// site, both countries:
//   under 7 days     a price, as it is
//   7 to 30 days     still shown, with its age ("checked 12 days ago"), and
//                    a total that counts it says "About" rather than exact
//   over 30 days     not shown on cards, totals, the shelf or anywhere else;
//                    it only goes into the "About" estimates (each volume's
//                    usual price, getRecordedMedians) until a fresh check
//                    replaces it
// The one exception: a volume's own page (and the preview search engines
// read of it, which has to match it) keeps its prices up to 90 days, with
// their age beside them. It's where people land from a search, and a dated
// price there still helps; search engines see exactly what visitors see
// Part of the price queries (priceQueries.ts lists the parts).
const DAY_MS = 24 * 60 * 60 * 1000;
export const FRESH_FOR_MS = 7 * DAY_MS;
export const SHOWN_FOR_MS = 30 * DAY_MS;
export const ON_ITS_OWN_PAGE_FOR_MS = 90 * DAY_MS;

// whether a price checked then can still be shown (`forMs`: on its own page,
// ON_ITS_OWN_PAGE_FOR_MS)
export const stillShown = (
  at: Date | string,
  now = Date.now(),
  forMs = SHOWN_FOR_MS,
) => now - new Date(at).getTime() <= forMs;

// the same, on the volume's own page
export const shownOnItsPage = (at: Date | string, now = Date.now()) =>
  stillShown(at, now, ON_ITS_OWN_PAGE_FOR_MS);
