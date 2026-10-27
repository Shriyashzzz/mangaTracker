// /api/prices/*  public: anyone can search volumes and compare prices.
// Each route has its own per-visitor allowance (rateLimit), sized to how
// it's used and how much it can cost us upstream
import { Router } from "express";
import prices from "../controllers/pricesController.js";
import { rateLimit } from "../middlewares/rateLimit.js";

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const pricesRouter = Router();

pricesRouter.get("/search", perMinute(40), prices.search);
// typeahead: called as people type, so it gets a bigger allowance
pricesRouter.get("/series-search", perMinute(120), prices.seriesSearch);
pricesRouter.get("/highlights", perMinute(60), prices.highlights);
pricesRouter.get("/series-index", perMinute(60), prices.seriesIndex);
pricesRouter.get("/series", perMinute(40), prices.series);
// covers: a series page loads 30+ at once
pricesRouter.get("/cover/:isbn", perMinute(600), prices.cover);
// link previews; cheap database reads
pricesRouter.get("/summary/volume/:isbn", perMinute(300), prices.volumeSummary);
pricesRouter.get("/summary/series", perMinute(300), prices.seriesSummary);
// last, so the names above aren't read as an ISBN. The only route that can
// spend a paid search, so the tightest allowance
pricesRouter.get("/:isbn", perMinute(30), prices.volume);
