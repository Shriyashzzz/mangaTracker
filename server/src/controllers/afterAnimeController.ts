// /api/after-anime/*  "Where does the anime leave off?" Public to read and
// to suggest a correction; reviewing the corrections is for the site's owner
// (ADMIN_USERNAME).
import type { NextFunction, Request, Response } from "express";
import { body, matchedData, param, query } from "express-validator";
import config from "../config/config.js";
import { AppError, NotFoundError } from "../errors/AppError.js";
import { sendError } from "../middlewares/errorHandler.js";
import { rejectInvalid } from "../middlewares/validate.js";
import userQueries from "../models/userQueries.js";
import {
  getAfterAnime,
  getAfterAnimeIndex,
} from "../prices/afterAnime/afterAnime.js";
import {
  decideFix,
  fixesToReview,
  suggestFix,
} from "../prices/afterAnime/fixStore.js";
import { isCrawler } from "../prices/crawlers.js";

const CACHE_10_MIN = "public, max-age=600";

const seriesName = [
  query("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Which series?"),
  rejectInvalid,
];

// GET /?name=  a series' seasons and where each leaves the manga
const show = [
  ...seriesName,
  async (req: Request, res: Response) => {
    const mayAsk = !isCrawler(req.get("user-agent"));
    const data = await getAfterAnime(matchedData(req).name, mayAsk);
    if (!data) throw new NotFoundError("We couldn't find that series.");
    res.json(data);
  },
];

// GET /index  every series with an answer
const index = async (_req: Request, res: Response) => {
  res.set("Cache-Control", CACHE_10_MIN).json(await getAfterAnimeIndex());
};

const optionalNumber = (field: string, max: number) =>
  body(field)
    .optional({ values: "null" })
    .isFloat({ min: 0, max })
    .withMessage("That number doesn't look right.")
    .toFloat();

const fixRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Which series?"),
  body("label")
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage("Which season is it about?"),
  optionalNumber("chapter", 5000),
  optionalNumber("volume", 500),
  body("source")
    .trim()
    .isLength({ max: 500 })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("Add a link to where you read it, starting with https://"),
  body("note").optional({ values: "null" }).trim().isLength({ max: 500 }),
  rejectInvalid,
];

// POST /fix  a reader's correction, kept for review
const suggest = [
  ...fixRules,
  async (req: Request, res: Response) => {
    const sent = matchedData(req);
    if (sent.chapter == null && sent.volume == null)
      throw new AppError(
        "Say the last chapter or the volume to start from.",
        400,
      );
    // only for a series we know, under its own name
    const series = await getAfterAnime(sent.name, false);
    if (!series) throw new NotFoundError("We couldn't find that series.");
    const kept = await suggestFix({
      slug: series.slug,
      name: series.name,
      label: sent.label,
      chapter: sent.chapter ?? null,
      volume: sent.volume == null ? null : Math.round(sent.volume),
      source: sent.source,
      note: sent.note || null,
    });
    if (!kept)
      throw new AppError(
        "This series already has corrections waiting to be read. Thanks all the same.",
        429,
      );
    res.status(201).json({ ok: true });
  },
];

// only the site's owner: the account named in ADMIN_USERNAME. Anyone else
// is told there's nothing here
async function requireOwnerOfSite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session.userId;
  const account = userId ? await userQueries.getAccount(userId) : null;
  const isOwner =
    Boolean(config.ADMIN_USERNAME) &&
    account?.username === config.ADMIN_USERNAME;
  if (!isOwner) return void sendError(res, 404, "Not found");
  next();
}

// GET /fixes  what's waiting and what was decided lately
const review = [
  requireOwnerOfSite,
  async (_req: Request, res: Response) => {
    res.json(await fixesToReview());
  },
];

// POST /fixes/:id  { accept: boolean }
const decide = [
  requireOwnerOfSite,
  param("id").isInt({ min: 1 }).toInt(),
  body("accept").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { id, accept } = matchedData(req);
    const fix = await decideFix(id, accept ? "accepted" : "rejected");
    if (!fix) throw new NotFoundError("That correction is gone.");
    res.json(fix);
  },
];

export default { show, index, suggest, review, decide };
