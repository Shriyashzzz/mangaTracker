// Everything the price checker stores: books (volumes), the prices we've
// fetched for them, when each was last checked, cached edition covers, and
// the monthly allowance of paid APIs.
//
// Simple reads and writes use Prisma's query builder. The statistics need
// window functions and DISTINCT ON, which Prisma can't express, so those are
// raw SQL ($queryRaw tagged templates: values are always sent as parameters,
// never pasted into the SQL).
//
// The queries live in the files beside this one, by what they store; this
// file gathers them, so everything else imports from here:
//   priceBooks.ts        books, price checks and the prices that stand now
//   priceHistory.ts      history, usual prices, cheapest copies
//   priceLists.ts        recently checked volumes and deals
//   apiAllowance.ts      the paid and metered APIs' monthly allowance
//   savedVolumes.ts      each series' saved list of volumes
//   coversAndSitemap.ts  edition covers and the sitemap
export * from "./priceBooks.js";
export * from "./priceHistory.js";
export * from "./priceLists.js";
export * from "./apiAllowance.js";
export * from "./savedVolumes.js";
export * from "./coversAndSitemap.js";

import {
  getBook,
  upsertBook,
  getLastCheck,
  saveCheck,
  getSourceChecks,
  getCurrentRows,
  getCurrentOffers,
} from "./priceBooks.js";
import {
  getKnownPrices,
  getCheapestCopies,
  getRecordedMedians,
  getPriceHistory,
  getNewPriceMedian,
} from "./priceHistory.js";
import { getRecentBestPrices, getDeals } from "./priceLists.js";
import {
  claimApiCall,
  anyCallsLeft,
  markApiSpent,
  recordSearch,
} from "./apiAllowance.js";
import {
  getSeriesVolumes,
  getSavedVolumeTitles,
  getFinalVolumeTitles,
  getCollectionOffers,
  getOmnibusIsbns,
  getSavedVolume,
  getSavedListSizes,
  getFoundNovels,
  saveSeriesVolumes,
  isKnownVolume,
} from "./savedVolumes.js";
import {
  getCoverIds,
  saveCoverIds,
  getSitemapEntries,
  getBookTitles,
} from "./coversAndSitemap.js";

// the same queries as one object: `priceQueries.getBook(...)`
export default {
  claimApiCall,
  anyCallsLeft,
  markApiSpent,
  recordSearch,
  getSeriesVolumes,
  getSavedVolumeTitles,
  getFinalVolumeTitles,
  getCollectionOffers,
  getOmnibusIsbns,
  getSavedVolume,
  getSavedListSizes,
  getFoundNovels,
  saveSeriesVolumes,
  getKnownPrices,
  getCheapestCopies,
  getRecordedMedians,
  getRecentBestPrices,
  getDeals,
  getBook,
  isKnownVolume,
  upsertBook,
  getLastCheck,
  saveCheck,
  getSourceChecks,
  getCurrentRows,
  getCurrentOffers,
  getPriceHistory,
  getNewPriceMedian,
  getCoverIds,
  saveCoverIds,
  getSitemapEntries,
  getBookTitles,
};
