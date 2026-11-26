// Entry point: start listening. Everything else is in app.ts.
import { app } from "./app.js";
import config from "./config/config.js";
import { startFiller } from "./collector/filler.js";
import { startUsedFiller } from "./collector/usedFiller.js";
import { startNewPriceFiller } from "./collector/newPriceFiller.js";
import { startAnimeFiller } from "./collector/animeFiller.js";
import { startEditionFiller } from "./collector/editionFiller.js";
import { startEditionFinder } from "./collector/editionFinder.js";
import { startDigestSender } from "./digest/digestSender.js";
import { startAlertSender } from "./push/pushSender.js";
import { startSeriesFiller } from "./prices/seriesFiller.js";
import { startSweep } from "./collector/sweep.js";
import { startScoreFiller } from "./collector/scoreFiller.js";
import { loadSwaps } from "./prices/trustedBooks.js";
import { startReaderBooks } from "./prices/readerBooks.js";
import { startDetailsFill } from "./prices/volumeDetails.js";
import { startGoogleBooksReport } from "./prices/callLog.js";

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
  // ISBNs a trusted book took the place of, so an old address finds its
  // volume from the first request (prices/trustedBooks.ts)
  loadSwaps().catch((e: Error) =>
    console.error("loading ISBN swaps:", e.message),
  );
  // readers agreeing on an ISBN's volume, made trusted books once a day
  startReaderBooks();
  // descriptions, pages and release dates for volume pages, a few Google
  // lookups a day (same switch as the fills)
  startDetailsFill();
  // yesterday's Google Books calls by job, in the log: where its quota went
  startGoogleBooksReport();
  // background pricing of shelf volumes (production unless PRICE_FILL=on)
  startFiller();
  startUsedFiller();
  startNewPriceFiller();
  startAnimeFiller();
  startEditionFiller();
  // series with editions we don't know yet, found by the editions' names
  startEditionFinder();
  startDigestSender();
  startAlertSender();
  // background volume lists for series nobody has opened yet (same switch)
  startSeriesFiller();
  // MyAnimeList's scores and AniList's means for every known series
  startScoreFiller();
  // the day's unused free calls, spent pricing unexplored series at night
  // (same switch, and PRICE_SWEEP=off)
  startSweep();
});
