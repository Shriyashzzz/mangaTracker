// One series on the shelf: list, add, details, edit, delete, and the small
// inline updates (status, to read, rating, chapter, hidden releases, cover,
// notes, volumes owned). Every :id route runs requireOwner first, which loads
// the manga onto res.locals.manga.
import type { Request, Response } from "express";
import { body, matchedData, param } from "express-validator";
import { rejectInvalid } from "../../middlewares/validate.js";
import mangaQueries from "../../models/mangaQueries.js";
import bookQueries from "../../models/bookQueries.js";
import { bookFields } from "../../util/shelf/ownedBooks.js";
import { getSeriesInfo } from "../../prices/sources/anilist.js";
import { canonicalTitle } from "../../util/shelf/canonicalTitle.js";
import type { Manga } from "../../../generated/prisma/client.js";
import { oneAtATime } from "../../util/shelf/oneAtATime.js";
import { keepSavedList, ownedVolumes } from "../../util/shelf/ownedList.js";
import {
  ownedListFields,
  mangaFields,
  onShelfAlready,
  toInput,
} from "./fields.js";

export const list = async (req: Request, res: Response) => {
  res.json({ manga: await mangaQueries.getShelf(req.session.userId!) });
};

export const add = [
  ...mangaFields,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const input = toInput(req);
    // named the way AniList names it, if AniList lists it. If AniList can't be
    // reached the title they typed is fine. Not a light novel: that lookup finds
    // the manga, whose name could replace the novel's
    if (!input.lightNovel) {
      const listing = await getSeriesInfo(input.name).catch(() => null);
      input.name = canonicalTitle(input.name, listing);
    }
    const userId = req.session.userId!;
    await oneAtATime(userId, async () => {
      if (
        await onShelfAlready(res, userId, input.name, {
          lightNovel: Boolean(input.lightNovel),
        })
      )
        return;
      const id = await mangaQueries.addManga(userId, input);
      res.status(201).json({ id });
    });
  },
];

export const detail = (_req: Request, res: Response) => {
  res.json({ manga: res.locals.manga });
};

export const update = [
  ...mangaFields,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const input = toInput(req);
    const { id, lightNovel } = res.locals.manga as Manga;
    // sent without a list: the saved one stays unless "up to" changed
    if (matchedData(req).ownedList === undefined)
      Object.assign(
        input,
        keepSavedList(
          res.locals.manga as Manga,
          input as { volumesOwned: number | null },
          "edit",
        ),
      );
    const userId = req.session.userId!;
    await oneAtATime(userId, async () => {
      if (
        await onShelfAlready(res, userId, input.name, {
          exceptId: id,
          lightNovel: input.lightNovel ?? lightNovel,
        })
      )
        return;
      await mangaQueries.updateManga(id, input);
      // what was found for it as a manga (or a novel) doesn't belong to the other
      if (input.lightNovel !== undefined && input.lightNovel !== lightNovel)
        await mangaQueries.clearReleaseMarks(id);
      res.sendStatus(204);
    });
  },
];

export const remove = async (_req: Request, res: Response) => {
  await mangaQueries.deleteManga(res.locals.manga.id);
  res.sendStatus(204);
};

export const setStatus = [
  body("status").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setStatus(res.locals.manga.id, matchedData(req).status);
    res.sendStatus(204);
  },
];

export const setPlanned = [
  body("planned").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setPlanned(
      res.locals.manga.id,
      matchedData(req).planned,
    );
    res.sendStatus(204);
  },
];

export const setRating = [
  body("rating").isInt({ min: 0, max: 5 }).withMessage("0 to 5 stars").toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setRating(res.locals.manga.id, matchedData(req).rating);
    res.sendStatus(204);
  },
];

// the chapter they're on, from the steppers on the details page
export const setBookmark = [
  body("bookmark")
    .isInt({ min: 0, max: 100000 })
    .withMessage("Bookmark has to be a number luv!")
    .toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setBookmark(
      res.locals.manga.id,
      matchedData(req).bookmark,
    );
    res.sendStatus(204);
  },
];

// their place by the volume: which way this series is tracked, and the last
// volume read (null clears it). Either can come alone
export const setReading = [
  body("byVolume").optional().isBoolean({ strict: true }),
  body("readVolume")
    .optional({ values: "null" })
    .isInt({ min: 0, max: 999 })
    .withMessage("Volumes go from 0 to 999")
    .toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    await mangaQueries.setReading(res.locals.manga.id, {
      ...(d.byVolume === undefined ? {} : { byVolume: d.byVolume }),
      ...("readVolume" in req.body ? { readVolume: d.readVolume ?? null } : {}),
    });
    res.sendStatus(204);
  },
];

// ---------- the books behind the owned volumes (models/bookQueries.ts) ----------

// every book on their shelf at once, for the backup
export const allBooks = async (req: Request, res: Response) => {
  res.json({ books: await bookQueries.shelfBooks(req.session.userId!) });
};

export const books = async (_req: Request, res: Response) => {
  res.json({ books: await bookQueries.booksOf(res.locals.manga.id) });
};

// a scanned book, recorded on its series. Only one whose volumes are owned
// there is kept, so the volumes are marked first
export const addBooks = [
  ...bookFields("books", 50),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const id = (res.locals.manga as Manga).id;
    await bookQueries.addBooks(id, matchedData(req).books ?? []);
    res.json({ books: await bookQueries.booksOf(id) });
  },
];

// a book they no longer have: it goes, with the volumes only it held
export const removeBook = [
  param("bookId").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const owned = await bookQueries.removeBook(
      (res.locals.manga as Manga).id,
      matchedData(req).bookId,
    );
    if (!owned) return void res.sendStatus(404);
    res.json(owned);
  },
];

// "Hide" on the New tab, and its undo. Null clears it. Volumes can also be hidden
// one at a time, sent as the whole list; leaving it out keeps the list as it is
export const setSeen = [
  body("kind").isIn(["volume", "chapter", "japan"]),
  body("number")
    .optional({ values: "null" })
    .isFloat({ min: 0, max: 100000 })
    .toFloat(),
  body("hiddenVolumes").optional().isArray({ max: 500 }),
  body("hiddenVolumes.*").isFloat({ min: 0, max: 100000 }).toFloat(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { kind, number, hiddenVolumes } = matchedData(req);
    await mangaQueries.setSeen(
      res.locals.manga.id,
      kind,
      number ?? null,
      kind === "volume" ? hiddenVolumes : undefined,
    );
    res.sendStatus(204);
  },
];

// a cover the shelf found for a series that came in without one (an import):
// only the image, and only an https address
export const setImage = [
  body("image")
    .isString()
    .trim()
    .isURL({ protocols: ["https"], require_protocol: true })
    .withMessage("Please provide a valid URL")
    .isLength({ max: 500 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setImage(res.locals.manga.id, matchedData(req).image);
    res.sendStatus(204);
  },
];

// typed straight on the details page. Only touches the notes, and empty clears them
export const setNotes = [
  body("description")
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: 450 })
    .withMessage("Notes can be up to 450 characters long <3"),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const description =
      (matchedData(req).description as string | undefined) || null;
    await mangaQueries.setNotes(res.locals.manga.id, description);
    res.sendStatus(204);
  },
];

// "I own Vol. 15", and its undo. Sets the number as given; null clears it
// "up to" a volume (null clears it), or the exact list
export const setOwned = [
  body("volumesOwned")
    .optional({ values: "null" })
    .isInt({ min: 1, max: 999 })
    .withMessage("That isn't a volume number.")
    .toInt(),
  ...ownedListFields("ownedList"),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    const manga = res.locals.manga as Manga;
    res.json(
      await mangaQueries.setVolumesOwned(
        manga.id,
        d.ownedList === undefined
          ? keepSavedList(
              manga,
              { volumesOwned: d.volumesOwned ?? null },
              "add one",
            )
          : ownedVolumes(d.volumesOwned ?? null, d.ownedList),
      ),
    );
  },
];
