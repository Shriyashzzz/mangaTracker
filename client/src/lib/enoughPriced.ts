// Most of a series priced before its total is said: with fewer, three prices
// would be passed off as the cost of thirty. One number for the series page,
// the shelf's "Finish the series" (lib/finishCost.ts) and the site server
// (client/server.ts). No imports, so the site server can read it.
// The server's own copy is server/src/collector/shelfMath.ts ENOUGH_PRICED:
// change both together
export const ENOUGH_PRICED = 0.6;
