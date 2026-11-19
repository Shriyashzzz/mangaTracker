// Entry point: start listening. Everything else is in app.ts.
import { app } from "./app.js";
import config from "./config/config.js";
import { startFiller } from "./collector/filler.js";
import { startUsedFiller } from "./collector/usedFiller.js";
import { startNewPriceFiller } from "./collector/newPriceFiller.js";
import { startAnimeFiller } from "./collector/animeFiller.js";
import { startEditionFiller } from "./collector/editionFiller.js";
import { startDigestSender } from "./digest/digestSender.js";
import { startAlertSender } from "./push/pushSender.js";
import { startSeriesFiller } from "./prices/seriesFiller.js";
import { startSweep } from "./collector/sweep.js";
import { startScoreFiller } from "./collector/scoreFiller.js";

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
  // background pricing of shelf volumes (production unless PRICE_FILL=on)
  startFiller();
  startUsedFiller();
  startNewPriceFiller();
  startAnimeFiller();
  startEditionFiller();
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
