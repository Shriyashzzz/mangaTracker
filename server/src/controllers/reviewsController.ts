// /api/reviews/*  readers' reviews of a volume. Anyone can read them; a
// signed-in reader who owns or has read the volume can write one, and any
// signed-in reader can flag someone else's. The reported ones are for the
// site's owner (ADMIN_USERNAME).
import type { Request, Response } from "express";
import { body, matchedData, param, query } from "express-validator";
import { requireSignIn } from "../middlewares/auth.js";
import { requireOwnerOfSite } from "../middlewares/ownerOfSite.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { knownSeriesName } from "../prices/sources/anilist.js";
import { toIsbn13 } from "../prices/sources/catalog.js";
import { slugify } from "../prices/stores/match.js";
import { MOST_WORDS } from "../reviews/reviewRules.js";
import {
  decideReview,
  deleteReview,
  flagReview,
  reviewsToCheck,
  seriesReviews,
  shelfReviews,
  volumeReviews,
  writeReview,
} from "../reviews/reviews.js";

// :isbn may be ISBN-10 or -13 with dashes; handlers always get an ISBN-13
const isbnParam = param("isbn")
  .customSanitizer(toIsbn13)
  .custom((isbn) => isbn !== null)
  .withMessage("That isn't a valid ISBN");
const idParam = param("id").isInt({ min: 1 }).toInt();

// GET /volume/:isbn  the volume's reviews, and whether you may write one
const ofVolume = [
  isbnParam,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { isbn } = matchedData(req);
    // each viewer's answer differs (theirs, may they write): never shared
    res
      .set("Cache-Control", "private, no-store")
      .json(await volumeReviews(isbn, req.session.userId ?? null));
  },
];

// PUT /volume/:isbn  { rating, text, spoiler }  your review of it
const write = [
  requireSignIn,
  isbnParam,
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Pick a rating from 1 to 5.")
    .toInt(),
  body("text")
    .default("")
    .isString()
    .isLength({ max: MOST_WORDS })
    .withMessage(`Keep it under ${MOST_WORDS} characters.`),
  body("spoiler").default(false).isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { isbn, rating, text, spoiler } = matchedData(req);
    const review = await writeReview(req.session.userId!, isbn, {
      rating,
      text,
      spoiler,
    });
    res.json(review);
  },
];

// DELETE /volume/:isbn  takes your review of it away
const remove = [
  requireSignIn,
  isbnParam,
  rejectInvalid,
  async (req: Request, res: Response) => {
    await deleteReview(req.session.userId!, matchedData(req).isbn);
    res.status(204).end();
  },
];

// POST /:id/flag  { kind: "spoiler" | "report" }  on someone else's review
const flag = [
  requireSignIn,
  idParam,
  body("kind").isIn(["spoiler", "report"]),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { id, kind } = matchedData(req);
    await flagReview(id, req.session.userId!, kind);
    res.status(204).end();
  },
];

// GET /series?name=  a series' ratings added up, and each reviewed volume's
const ofSeries = [
  query("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Which series?"),
  rejectInvalid,
  async (req: Request, res: Response) => {
    // under the name the price pages know it by
    const name = await knownSeriesName(matchedData(req).name);
    res
      .set("Cache-Control", "public, max-age=300")
      .json(await seriesReviews(slugify(name)));
  },
];

// GET /shelf?manga=  for a series on your shelf: the volumes you could rate
// next, and the reviews you've written of it
const onShelf = [
  requireSignIn,
  query("manga").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { manga } = matchedData(req);
    res
      .set("Cache-Control", "private, no-store")
      .json(await shelfReviews(req.session.userId!, manga));
  },
];

// GET /reported  for the site's owner: every review with a report
const reported = [
  requireOwnerOfSite,
  async (_req: Request, res: Response) => {
    res.json(await reviewsToCheck());
  },
];

// POST /:id/decide  { keep: boolean }  keep a reported review, or remove it
const decide = [
  requireOwnerOfSite,
  idParam,
  body("keep").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { id, keep } = matchedData(req);
    await decideReview(id, keep);
    res.status(204).end();
  },
];

export default {
  ofVolume,
  write,
  remove,
  flag,
  ofSeries,
  onShelf,
  reported,
  decide,
};
