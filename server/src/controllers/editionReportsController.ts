// /api/editions/*: readers reporting an omnibus or deluxe book no catalog
// lists, and the site owner's review of them (util/shelf/editionReports.ts)
import type { Request, Response } from "express";
import { body, matchedData } from "express-validator";
import { NotFoundError } from "../errors/AppError.js";
import { requireOwnerOfSite } from "../middlewares/ownerOfSite.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { editionLinesOf } from "../prices/editionSource.js";
import {
  decideBook,
  reportBook,
  reportsToReview,
} from "../util/shelf/editionReports.js";

const book = [
  body("edition")
    .isString()
    .matches(/^[a-z0-9]{2,20}$/)
    .withMessage("Which edition?"),
  body("number").isInt({ min: 1, max: 300 }).toInt(),
  body("volumes")
    .isArray({ min: 1, max: 12 })
    .withMessage("Which volumes does it hold?"),
  body("volumes.*").isInt({ min: 1, max: 2000 }).toInt(),
];

// POST /reports  { name, edition, number, volumes }: a signed-in reader's
// report, for a line the series has
const report = [
  body("name").isString().trim().isLength({ min: 2, max: 120 }),
  ...book,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const sent = matchedData(req);
    // only an edition the series' page knows: saved lines, never a search
    const lines = await editionLinesOf(sent.name, [], false);
    if (!lines.some((line) => line.key === sent.edition))
      throw new NotFoundError("We don't know that edition of the series.");
    await reportBook(req.session.userId!, {
      name: sent.name,
      edition: sent.edition,
      number: sent.number,
      volumes: sent.volumes,
    });
    res.status(201).json({ ok: true });
  },
];

// GET /reports  the owner's review page
const review = [
  requireOwnerOfSite,
  async (_req: Request, res: Response) => {
    res.json(await reportsToReview());
  },
];

// POST /reports/decide  { series, edition, number, volumes, approve }
const decide = [
  requireOwnerOfSite,
  body("series").isString().isLength({ min: 2, max: 200 }),
  ...book,
  body("approve").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const sent = matchedData(req);
    await decideBook(
      sent.series,
      sent.edition,
      sent.number,
      sent.approve ? "approved" : "rejected",
      sent.volumes,
    );
    res.json({ ok: true });
  },
];

export default { report, review, decide };
