// /api/after-anime/*  where a series' anime leaves its manga. Reading is
// public; so is suggesting a correction, a few at a time
import { Router } from "express";
import afterAnime from "../controllers/afterAnimeController.js";
import { rateLimit } from "../middlewares/rateLimit.js";

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const afterAnimeRouter = Router();

afterAnimeRouter.get("/", perMinute(40), afterAnime.show);
afterAnimeRouter.get("/index", perMinute(60), afterAnime.index);
afterAnimeRouter.get("/buy", perMinute(60), afterAnime.buy);
afterAnimeRouter.post(
  "/fix",
  rateLimit({ max: 5, windowMs: 10 * 60_000 }),
  afterAnime.suggest,
);
afterAnimeRouter.get("/fixes", perMinute(60), afterAnime.review);
afterAnimeRouter.post("/fixes/:id", perMinute(60), afterAnime.decide);
