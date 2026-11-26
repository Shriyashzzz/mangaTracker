// How long a saved price counts as fresh: older, it's shown with its age,
// and a total counting it says "About". One rule for the whole site: the
// server's models/priceAge.ts FRESH_FOR_MS. On its own, with nothing to
// import, so the server's tests can load what uses it
export const PRICE_FRESH_DAYS = 7;
