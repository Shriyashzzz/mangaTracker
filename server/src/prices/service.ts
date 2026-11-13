// The price checker's brain. Controllers call these; these call the
// catalog (Open Library), AniList, the price providers and the database.
//
//   getVolumePrices   one volume's page: offers, history, series, siblings
//   getSeries         one series' page: every US volume with known prices
//   getHighlights     the home page: trending, deals, recently checked
//   getShelfPrices    cheapest known price per manga on someone's shelf
//   getSeriesIndex    the /series page
//   get*Summary       database-only data for link previews and crawlers
//
// Only opening a volume page can spend a paid search, and at most once per
// volume every FRESH_FOR_MS; everything else reads what's already stored.
//
// The code lives in six files beside this one; this file only gathers them,
// so everything else imports from here:
//   volumeNames.ts     how a volume and its stores are named
//   volumeService.ts   one volume's prices, and the sources that are checked
//   scanService.ts     a scanned barcode
//   seriesService.ts   a series' list of volumes
//   shelfService.ts    prices for someone's shelf
//   pagesService.ts    the series index, link previews, deals and price home
export { searchSeries } from "./sources/anilist.js";
export * from "./volumeNames.js";
export * from "./volumeService.js";
export * from "./scanService.js";
export * from "./seriesService.js";
export * from "./shelfService.js";
export * from "./pagesService.js";
