import { Router } from "express";
import pricesController from "../controller/pricesController.js";
import { rateLimit } from "../prices/rateLimit.js";

// public: anyone can search volumes and compare prices, no account needed
export const pricesRouter = Router();

pricesRouter.get(
  "/search",
  rateLimit({ max: 40, windowMs: 60_000 }),
  pricesController.search,
);

// these come before "/:isbn" so their names aren't read as an ISBN
pricesRouter.get(
  "/highlights",
  rateLimit({ max: 60, windowMs: 60_000 }),
  pricesController.highlights,
);

// typeahead: called as people type, so it gets a bigger allowance
pricesRouter.get(
  "/series-search",
  rateLimit({ max: 120, windowMs: 60_000 }),
  pricesController.seriesSearch,
);

pricesRouter.get(
  "/series",
  rateLimit({ max: 40, windowMs: 60_000 }),
  pricesController.series,
);

pricesRouter.get(
  "/:isbn",
  rateLimit({ max: 30, windowMs: 60_000 }),
  pricesController.volume,
);
