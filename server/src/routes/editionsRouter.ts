// /api/editions/*  readers' reports of omnibus and deluxe books no catalog
// lists: reporting needs an account and is limited; reviewing is the owner's
import { Router } from "express";
import editions from "../controllers/editionReportsController.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";

export const editionsRouter = Router();

editionsRouter.post(
  "/reports",
  requireSignIn,
  rateLimit({ max: 10, windowMs: 10 * 60_000 }),
  editions.report,
);
editionsRouter.get(
  "/reports",
  rateLimit({ max: 60, windowMs: 60_000 }),
  editions.review,
);
editionsRouter.post(
  "/reports/decide",
  rateLimit({ max: 60, windowMs: 60_000 }),
  editions.decide,
);
