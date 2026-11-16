// /api/reviews/*  readers' reviews of a volume. Anyone can read them; a
// signed-in reader who owns or has read the volume can write one, and any
// signed-in reader can flag someone else's. The reported ones are for the
// site's owner (ADMIN_USERNAME).
import type { Request, Response } from "express";
import { body, matchedData, param, query } from "express-validator";
import { requireSignIn } from "../middlewares/auth.js";
import { requireOwnerOfSite } from "../middlewares/ownerOfSite.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { toIsbn13 } from "../prices/sources/catalog.js";
import { MOST_WORDS } from "../reviews/reviewRules.js";
import {
  decideReview,
  deleteReview,
  deleteShelfReview,
  flagReview,
  reviewsToCheck,
  shelfReviews,
  volumeReviews,
  writeReview,
  writeShelfReview,
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
// a review as it's sent: stars, and optionally words and a spoiler tick
const reviewBody = [
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
];

const write = [
  requireSignIn,
  isbnParam,
  ...reviewBody,
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

// GET /shelf?manga=  for a series on your shelf: the volumes you could rate
// next, and the reviews you've written of it
// a volume of a series on their shelf, by the series' id and the volume's
// number: /shelf/:manga/:volume
const shelfVolume = [
  param("manga").isInt({ min: 1 }).toInt(),
  param("volume").isInt({ min: 1, max: 999 }).toInt(),
];

// PUT /shelf/:manga/:volume  their review of that volume, written from the
// series' page. Works for a volume we have no book for
const writeOnShelf = [
  requireSignIn,
  ...shelfVolume,
  ...reviewBody,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { manga, volume, rating, text, spoiler } = matchedData(req);
    res.json(
      await writeShelfReview(req.session.userId!, manga, volume, {
        rating,
        text,
        spoiler,
      }),
    );
  },
];

// DELETE /shelf/:manga/:volume
const removeOnShelf = [
  requireSignIn,
  ...shelfVolume,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { manga, volume } = matchedData(req);
    await deleteShelfReview(req.session.userId!, manga, volume);
    res.status(204).end();
  },
];

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
  onShelf,
  writeOnShelf,
  removeOnShelf,
  reported,
  decide,
};
