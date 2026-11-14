// /api/reviews/*  readers' reviews of a volume. Reading is public; writing
// and flagging need a sign-in (and are limited again per account, in
// reviews/reviews.ts)
import { Router } from "express";
import reviews from "../controllers/reviewsController.js";
import { rateLimit } from "../middlewares/rateLimit.js";

const perMinute = (max: number) => rateLimit({ max, windowMs: 60_000 });

export const reviewsRouter = Router();

reviewsRouter.get("/volume/:isbn", perMinute(60), reviews.ofVolume);
reviewsRouter.put("/volume/:isbn", perMinute(10), reviews.write);
reviewsRouter.delete("/volume/:isbn", perMinute(10), reviews.remove);
reviewsRouter.get("/series", perMinute(60), reviews.ofSeries);
// asked by every series page someone opens, so it gets more room
reviewsRouter.get("/shelf", perMinute(120), reviews.onShelf);
reviewsRouter.get("/reported", perMinute(60), reviews.reported);
reviewsRouter.post("/:id/flag", perMinute(20), reviews.flag);
reviewsRouter.post("/:id/decide", perMinute(60), reviews.decide);
