// The shelf: list, add, edit, delete, and the small inline updates (status,
// rating, volumes owned). Every :id route runs requireOwner first, which
// loads the manga onto res.locals.manga.
import type { Request, Response } from "express";
import { body, matchedData, query } from "express-validator";
import { rejectInvalid } from "../middlewares/validate.js";
import mangaQueries, { type MangaInput } from "../models/mangaQueries.js";
import { findOnShelf, getShelfPrices } from "../prices/service.js";

// ---------- validation shared by add and edit ----------

const mangaFields = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Manga title cannot be empty luv <3")
    .isLength({ min: 3, max: 150 })
    .withMessage("Title should be between 3 to 150 characters long! <3"),
  body("bookmark")
    .optional({ values: "falsy" })
    .isInt({ min: 0, max: 100000 })
    .withMessage("Bookmark has to be a number luv!")
    .toInt(),
  body("status").isBoolean().withMessage("Status is reading or done").toBoolean(),
  // the last volume they own; blank (or 0) means they don't say
  body("volumesOwned")
    .optional({ values: "falsy" })
    .isInt({ min: 0, max: 999 })
    .withMessage("Volumes owned has to be a whole number, like 14")
    .toInt(),
  body("genre").optional({ values: "falsy" }).trim().isLength({ max: 100 }),
  body("description")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 450 })
    .withMessage("Notes can be up to 450 characters long <3"),
  body("image")
    .optional({ values: "falsy" })
    .trim()
    .isURL()
    .withMessage("Please provide a valid URL"),
];

// the validated body as the query layer wants it: blanks become null
const toInput = (req: Request): MangaInput => {
  const d = matchedData(req);
  return {
    name: d.name,
    status: d.status,
    bookmark: d.bookmark || null,
    volumesOwned: d.volumesOwned || null,
    genre: d.genre || null,
    description: d.description || null,
    image: d.image || null,
  };
};

// ---------- handlers ----------

const list = async (req: Request, res: Response) => {
  res.json({ manga: await mangaQueries.getShelf(req.session.userId!) });
};

const add = [
  ...mangaFields,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const id = await mangaQueries.addManga(req.session.userId!, toInput(req));
    res.status(201).json({ id });
  },
];

const detail = (_req: Request, res: Response) => {
  res.json({ manga: res.locals.manga });
};

const update = [
  ...mangaFields,
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.updateManga(res.locals.manga.id, toInput(req));
    res.sendStatus(204);
  },
];

const remove = async (_req: Request, res: Response) => {
  await mangaQueries.deleteManga(res.locals.manga.id);
  res.sendStatus(204);
};

const setStatus = [
  body("status").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setStatus(res.locals.manga.id, matchedData(req).status);
    res.sendStatus(204);
  },
];

const setRating = [
  body("rating").isInt({ min: 0, max: 5 }).withMessage("0 to 5 stars").toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setRating(res.locals.manga.id, matchedData(req).rating);
    res.sendStatus(204);
  },
];

// "I own Vol. 15", and its undo. Sets the number as given; null clears it
const setOwned = [
  body("volumesOwned")
    .optional({ values: "null" })
    .isInt({ min: 1, max: 999 })
    .withMessage("That isn't a volume number.")
    .toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const value = matchedData(req).volumesOwned ?? null;
    res.json({
      volumesOwned: await mangaQueries.setVolumesOwned(res.locals.manga.id, value),
    });
  },
];

// the cheapest known price for each manga on the shelf, for the cards
const shelfPrices = async (req: Request, res: Response) => {
  const manga = await mangaQueries.getShelf(req.session.userId!);
  res.json(await getShelfPrices(manga.map((m) => ({ id: m.id, name: m.name }))));
};

// is this series on the shelf? For the volume page's shelf button
const match = [
  query("series").trim().isLength({ min: 2, max: 150 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const manga = await mangaQueries.getShelf(req.session.userId!);
    const found = await findOnShelf(manga, matchedData(req).series);
    res.json(
      found && {
        id: found.id,
        name: found.name,
        bookmark: found.bookmark,
        status: found.status,
        volumesOwned: found.volumesOwned,
      },
    );
  },
];

export default {
  list,
  add,
  detail,
  update,
  remove,
  setStatus,
  setRating,
  setOwned,
  shelfPrices,
  match,
};
