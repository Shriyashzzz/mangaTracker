// /api/collector/*: the shelf tools (collector.ts) and the stores' sales.
// COLLECTOR_TOOLS=off answers 404 to all of them, as if they didn't exist
import { countryOf } from "../models/priceQueries.js";
import { Router, type RequestHandler } from "express";
import config from "../config/config.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { getCalendar, getSeriesWorth, getShelfTools } from "./collector.js";
import { dealLink, liveDeals } from "./deals.js";

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });
const switchedOn: RequestHandler = (_req, res, next) => {
  if (config.COLLECTOR_TOOLS === "off") {
    res.sendStatus(404);
    return;
  }
  next();
};

export const collectorRouter = Router();
collectorRouter.use(switchedOn);

// public: the price pages show them to everyone
collectorRouter.get("/deals", perMinute(120), (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    deals: liveDeals().map((d) => ({ ...d, url: dealLink(d.url) })),
  });
});

// a shelf's own: signed in, and only ever their own
collectorRouter.get(
  "/shelf",
  requireSignIn,
  perMinute(30),
  async (req, res, next) => {
    try {
      res.json(
        await getShelfTools(req.session.userId!, countryOf(req.query.country)),
      );
    } catch (e) {
      next(e);
    }
  },
);
// one series of theirs: what its owned volumes would fetch used
collectorRouter.get(
  "/series/:id",
  requireSignIn,
  perMinute(60),
  async (req, res, next) => {
    try {
      const mangaId = Number(req.params.id);
      if (!Number.isInteger(mangaId) || mangaId < 1) {
        res.sendStatus(404);
        return;
      }
      const worth = await getSeriesWorth(
        req.session.userId!,
        mangaId,
        countryOf(req.query.country),
      );
      if (!worth) {
        res.sendStatus(404);
        return;
      }
      res.json(worth);
    } catch (e) {
      next(e);
    }
  },
);
collectorRouter.get(
  "/calendar",
  requireSignIn,
  perMinute(30),
  async (req, res, next) => {
    try {
      res.json({ months: await getCalendar(req.session.userId!) });
    } catch (e) {
      next(e);
    }
  },
);
