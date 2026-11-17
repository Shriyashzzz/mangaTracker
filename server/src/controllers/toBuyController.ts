// /api/to-buy/*  a signed-in reader's To buy list (toBuy/toBuy.ts)
import type { Request, Response } from "express";
import { matchedData, param } from "express-validator";
import { requireSignIn } from "../middlewares/auth.js";
import { sendError } from "../middlewares/errorHandler.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { countryOf } from "../models/priceTables.js";
import { toIsbn13 } from "../prices/sources/catalog.js";
import {
  addToBuy,
  clearToBuy,
  MOST_TO_BUY,
  removeToBuy,
  toBuyList,
} from "../toBuy/toBuy.js";

// :isbn may be ISBN-10 or -13 with dashes; handlers always get an ISBN-13
const isbnParam = param("isbn")
  .customSanitizer(toIsbn13)
  .custom((isbn) => isbn !== null)
  .withMessage("That isn't a valid ISBN");

// each reader's own list: never kept by a cache between them
const own = (res: Response) => res.set("Cache-Control", "private, no-store");

// GET /?country=  the list with its prices and totals
const list = [
  requireSignIn,
  async (req: Request, res: Response) => {
    own(res).json(
      await toBuyList(req.session.userId!, countryOf(req.query.country)),
    );
  },
];

// PUT /:isbn  adds the volume
const add = [
  requireSignIn,
  isbnParam,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const added = await addToBuy(req.session.userId!, matchedData(req).isbn);
    if (added === "unknown")
      return void sendError(res, 404, "We couldn't find that volume.");
    if (added === "full")
      return void sendError(
        res,
        409,
        `Your To buy list is full (${MOST_TO_BUY}). Take one off first.`,
      );
    own(res).json({ ok: true });
  },
];

// DELETE /:isbn  takes it off
const remove = [
  requireSignIn,
  isbnParam,
  rejectInvalid,
  async (req: Request, res: Response) => {
    await removeToBuy(req.session.userId!, matchedData(req).isbn);
    own(res).json({ ok: true });
  },
];

// DELETE /  empties the list
const clear = [
  requireSignIn,
  async (req: Request, res: Response) => {
    await clearToBuy(req.session.userId!);
    own(res).json({ ok: true });
  },
];

export default { list, add, remove, clear };
