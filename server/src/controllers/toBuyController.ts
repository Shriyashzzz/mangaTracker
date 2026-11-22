// /api/to-buy/*  a signed-in reader's To buy list (toBuy/toBuy.ts)
import type { Request, Response } from "express";
import { body, matchedData, param } from "express-validator";
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
  addFromToBuy,
  settleToBuy,
  setToBuyAlert,
  setToBuyNote,
  TO_BUY_ALERT_MOST_CENTS,
  setToBuyOrder,
  TO_BUY_NOTE_MAX,
  toBuyList,
} from "../toBuy/toBuy.js";
import { chapterMessage, nameField, ownedListFields } from "./manga/fields.js";

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

// POST /:isbn/settle {how: "owned" | "ordered"}  "I bought it" or "I
// ordered it": off the list, and on the shelf when that's certain
const settle = [
  requireSignIn,
  isbnParam,
  body("how").isIn(["owned", "ordered"]),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    const settled = await settleToBuy(req.session.userId!, d.isbn, d.how);
    if (settled === "gone")
      return void sendError(res, 404, "That's not on your list any more.");
    own(res).json(settled);
  },
];

// POST /:isbn/add-series {name, planned, how}  "Add it to your shelf?":
// the series added with the book's volumes owned or ordered (when certain),
// or, one by that name already there, the volumes put on it
const addSeries = [
  requireSignIn,
  isbnParam,
  nameField(),
  body("planned").isBoolean().toBoolean(),
  body("how").isIn(["owned", "ordered"]),
  // the other volumes they ticked, and where they've read up to: the same
  // rules as Add manga's
  ...ownedListFields("owned"),
  body("bookmark")
    .optional({ values: "null" })
    .isInt({ min: 0, max: 100000 })
    .withMessage(chapterMessage)
    .toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    const added = await addFromToBuy(req.session.userId!, d.isbn, {
      name: d.name,
      planned: d.planned,
      how: d.how,
      owned: d.owned,
      bookmark: d.bookmark,
    });
    if (added === "gone")
      return void sendError(res, 404, "We couldn't find that book.");
    own(res)
      .status(added.added ? 201 : 200)
      .json(added);
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

// PATCH /:isbn {note?, alertCents?}  their own note on it (empty takes it
// off), and the price they want an alert at (null takes it off). Either
// alone, or both
const note = [
  requireSignIn,
  isbnParam,
  body("note").optional().isString().isLength({ max: TO_BUY_NOTE_MAX }),
  body("alertCents")
    .optional({ values: "undefined" })
    .custom(
      (cents: unknown) =>
        cents === null ||
        (Number.isInteger(cents) &&
          (cents as number) >= 1 &&
          (cents as number) <= TO_BUY_ALERT_MOST_CENTS),
    )
    .withMessage("That isn't a price we can watch for."),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { isbn } = matchedData(req) as { isbn: string };
    const { note: text, alertCents } = req.body as {
      note?: string;
      alertCents?: number | null;
    };
    const userId = req.session.userId!;
    if (text !== undefined) await setToBuyNote(userId, isbn, text);
    if (alertCents !== undefined) await setToBuyAlert(userId, isbn, alertCents);
    own(res).json({ ok: true });
  },
];

// PUT /order {isbns}  their own order for the list, first to last
const order = [
  requireSignIn,
  body("isbns").isArray({ max: MOST_TO_BUY }),
  body("isbns.*")
    .customSanitizer(toIsbn13)
    .custom((isbn) => isbn !== null),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { isbns } = matchedData(req) as { isbns: string[] };
    await setToBuyOrder(req.session.userId!, isbns);
    own(res).json({ ok: true });
  },
];

export default { list, add, remove, clear, settle, addSeries, note, order };
