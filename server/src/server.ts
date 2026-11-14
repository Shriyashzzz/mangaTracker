// Entry point: start listening. Everything else is in app.ts.
import { app } from "./app.js";
import config from "./config/config.js";
import { startFiller } from "./collector/filler.js";
import { startUsedFiller } from "./collector/usedFiller.js";
import { startNewPriceFiller } from "./collector/newPriceFiller.js";
import { startAnimeFiller } from "./collector/animeFiller.js";
import { startSeriesFiller } from "./prices/seriesFiller.js";

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
  // background pricing of shelf volumes (production unless PRICE_FILL=on)
  startFiller();
  startUsedFiller();
  startNewPriceFiller();
  startAnimeFiller();
  // background volume lists for series nobody has opened yet (same switch)
  startSeriesFiller();
});
