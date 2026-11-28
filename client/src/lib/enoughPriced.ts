// When a whole series' total is worth saying: with at least half its books
// priced. "About $880 for all 37" from 12 prices is mostly guesswork, and
// people decide whether to start a series on it. One rule for the series
// page's box, its search description and the crawler page (client/server.ts).
// On its own, with nothing to import, so the site server can load it
export const ENOUGH_PRICED_SHARE = 0.5;

export const enoughPriced = (priced: number, books: number) =>
  books > 0 && priced >= books * ENOUGH_PRICED_SHARE;
