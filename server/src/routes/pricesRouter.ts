// /api/prices/*  public: anyone can search volumes and compare prices.
// Each route has its own per-visitor allowance (rateLimit), sized to how
// it's used and how much it can cost us upstream
import { Router, type RequestHandler } from "express";
import prices from "../controllers/pricesController.js";
import { rateLimit } from "../middlewares/rateLimit.js";

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const pricesRouter = Router();

pricesRouter.get("/search", perMinute(40), prices.search);
// Canadian prices, sandboxed in prices/canada; before "/:isbn" so it isn't read as one
pricesRouter.get("/ca/:isbn", perMinute(20), prices.canadaVolume);
// typeahead: called as people type, so it gets a bigger allowance
pricesRouter.get("/series-search", perMinute(120), prices.seriesSearch);
pricesRouter.get("/highlights", perMinute(60), prices.highlights);
pricesRouter.get("/deals", perMinute(60), prices.deals);
pricesRouter.get("/series-index", perMinute(60), prices.seriesIndex);
pricesRouter.get("/series", perMinute(40), prices.series);
// a look for its box sets at the free sources, when the saved answer is old
pricesRouter.get("/series-sets", perMinute(20), prices.seriesSets);
// its omnibus and deluxe lines, for a reader collecting one
pricesRouter.get("/editions", perMinute(40), prices.editions);
// covers: a series page loads 30+ at once
pricesRouter.get("/cover/:isbn", perMinute(600), prices.cover);
// link previews; cheap database reads
pricesRouter.get("/summary/volume/:isbn", perMinute(300), prices.volumeSummary);
// a scanned barcode (Open Library at most, never a paid search)
pricesRouter.get("/scan/:isbn", perMinute(60), prices.scan);
pricesRouter.get("/summary/series", perMinute(300), prices.seriesSummary);
// last, so the names above aren't read as an ISBN. A volume page asks twice:
// its stored prices (?stored=1), then a live check, the only call that can
// spend a paid search. Each has its own allowance, so the first doesn't use
// up the second's
const storedVolume = perMinute(30);
const liveVolume = perMinute(30);
const volumeAllowance: RequestHandler = (req, res, next) =>
  (req.query.stored === "1" ? storedVolume : liveVolume)(req, res, next);
pricesRouter.get("/:isbn", volumeAllowance, prices.volume);
