// One series on the shelf: list, add, details, edit, delete, and the small
// inline updates (status, to read, rating, chapter, hidden releases, cover,
// notes, volumes owned). Every :id route runs requireOwner first, which loads
// the manga onto res.locals.manga.
import { roomFor } from "../../plan/plan.js";
import { noteReaderBooks } from "../../prices/readerBooks.js";
import { isShown } from "../../models/bookQueries.js";
import { ownedSet } from "../../collector/shelfMath.js";
import { editionStamp } from "../../util/shelf/editionStamp.js";
import { editionPlaceOf } from "../../util/shelf/editionPlace.js";
import { shelfEditionLines } from "../../collector/shelfSeries.js";
import { withoutEdition } from "../../util/shelf/editionNames.js";
import { slugify } from "../../prices/stores/match.js";
import type { NextFunction, Request, Response } from "express";
import { body, matchedData, param } from "express-validator";
import { ROW_ID, rejectInvalid } from "../../middlewares/validate.js";
import mangaQueries from "../../models/mangaQueries.js";
import bookQueries from "../../models/bookQueries.js";
import { bookFields, purchaseFields } from "../../util/shelf/ownedBooks.js";
import { getSeriesInfo } from "../../prices/sources/anilist.js";
import { canonicalTitle } from "../../util/shelf/canonicalTitle.js";
import type { Manga } from "../../../generated/prisma/client.js";
import { askAboutFinishedVolume } from "../../reviews/reviews.js";
import { newestChapterKnown } from "../../util/releases/releaseAnswers.js";
import { sendError } from "../../middlewares/errorHandler.js";
import { oneAtATime } from "../../util/shelf/oneAtATime.js";
import { recordTickedBooks } from "../../util/shelf/tickedBooks.js";
import { keepSavedList, ownedVolumes } from "../../util/shelf/ownedList.js";
import {
  chapterMessage,
  ownedListFields,
  mangaFields,
  onShelfAlready,
  toInput,
} from "./fields.js";

// each series with what the shelf's cards need beyond its own row:
//   editionStamp  the edition they own most of it in ("Definitive +2")
//   seriesKey     the series it's an entry of, edition or not: two entries
//                 with the same key are one series, and the shelf offers to
//                 merge them ("Vagabond" and "Vagabond VIZBIG Edition")
//   plainName     its name without the edition's words, when it has any
//   editionPlace  where they are in the edition they collect ("VIZBIG 4"),
//                 for a series collected in one (util/shelf/editionPlace.ts)
export const list = async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const [shelf, books] = await Promise.all([
    mangaQueries.getShelf(userId),
    bookQueries.shelfBooksBySeries(userId),
  ]);
  // (never the reason the shelf doesn't open: without it cards say volumes)
  const lines = await shelfEditionLines(shelf).catch(() => new Map());
  res.json({
    manga: shelf.map((m) => {
      const plainName = withoutEdition(m.name);
      const theirs = (books.get(m.id) ?? []).filter((b) => isShown(b, m));
      const line = lines.get(m.id);
      return {
        ...m,
        editionPlace: line
          ? editionPlaceOf(line, m.readVolume, [...ownedSet(m)])
          : null,
        editionStamp: editionStamp(theirs, ownedSet(m)),
        seriesKey: `${slugify(plainName)}${m.lightNovel ? ":novel" : ""}`,
        plainName: plainName === m.name ? null : plainName,
      };
    }),
  });
};

export const add = [
  ...mangaFields,
  rejectInvalid,
  async (req: Request, res: Response) => {
    // a free shelf has room for so many (src/plan/); what's on it stays
    if (!(await roomFor(req, res, "series"))) return;
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

// how far past the newest chapter we know a place can be: the list can lag a
// little behind what's out. The chapter box says the same
// (client pages/Details/ChapterStepper.tsx PAST_THE_NEWEST)
export const PAST_THE_NEWEST = 100;

// a chapter far past the newest out (5000 on a 220-chapter series) is a slip,
// whichever way it's sent. A series with no newest known keeps 100,000
async function notPastTheNewest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const chapter = matchedData(req).bookmark;
  if (typeof chapter === "number") {
    const newest = await newestChapterKnown((res.locals.manga as Manga).id);
    if (newest != null && chapter > newest + PAST_THE_NEWEST)
      return sendError(
        res,
        400,
        `Chapter ${newest.toLocaleString("en-US")} is the newest out.`,
      );
  }
  next();
}

export const update = [
  ...mangaFields,
  rejectInvalid,
  notPastTheNewest,
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
    const { status } = matchedData(req);
    await mangaQueries.setStatus(res.locals.manga.id, status);
    // finishing the series is finishing its last volume
    if (status)
      await askAboutFinishedVolume(req.session.userId!, res.locals.manga.id);
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
    .withMessage(chapterMessage)
    .toInt(),
  rejectInvalid,
  notPastTheNewest,
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
  // the edition they collect, by its line's key; null is single volumes
  body("edition")
    .optional({ values: "null" })
    .matches(/^[a-z0-9]{1,20}$/),
  body("readVolume")
    .optional({ values: "null" })
    .isInt({ min: 0, max: 999 })
    .withMessage("Volumes go from 0 to 999")
    .toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    const manga = res.locals.manga;
    await mangaQueries.setReading(manga, {
      ...(d.byVolume === undefined ? {} : { byVolume: d.byVolume }),
      ...("readVolume" in req.body ? { readVolume: d.readVolume ?? null } : {}),
      ...("edition" in req.body ? { edition: d.edition ?? null } : {}),
    });
    // further than they'd read before: they've just finished a volume
    if ((d.readVolume ?? 0) > (manga.readVolume ?? 0))
      await askAboutFinishedVolume(req.session.userId!, manga.id);
    res.sendStatus(204);
  },
];

// the cross on "You finished vol. 8. What did you think?": not asked again
// until they finish another volume
export const forgetFinishedVolume = async (_req: Request, res: Response) => {
  await mangaQueries.forgetFinishedVolume(res.locals.manga.id);
  res.sendStatus(204);
};

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
    const manga = res.locals.manga as Manga;
    const books = matchedData(req).books ?? [];
    await bookQueries.addBooks(manga.id, books);
    res.json({ books: await bookQueries.booksOf(manga.id) });
    // a scanned barcode says which volume its ISBN is, toward readers
    // agreeing on it (prices/readerBooks.ts); after the answer
    noteReaderBooks(req.session.userId!, manga, books, "scan").catch(
      (e: Error) => console.error("noting scanned books:", e.message),
    );
  },
];

// what they paid for a book and the day they bought it
export const setPurchase = [
  param("bookId").isInt(ROW_ID).toInt(),
  ...purchaseFields(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    const saved = await bookQueries.setPurchase(
      (res.locals.manga as Manga).id,
      d.bookId,
      {
        ...("paidCents" in req.body ? { paidCents: d.paidCents ?? null } : {}),
        ...("boughtOn" in req.body ? { boughtOn: d.boughtOn ?? null } : {}),
        ...("lentTo" in req.body ? { lentTo: d.lentTo || null } : {}),
      },
    );
    if (!saved) return void res.sendStatus(404);
    res.sendStatus(204);
  },
];

// a book they no longer have: it goes, with the volumes only it held
export const removeBook = [
  param("bookId").isInt(ROW_ID).toInt(),
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

// "I ordered it": a volume ordered and on its way, or taken off that list.
// Owning it later takes it off by itself (the database: manga_arrived)
// (an edition's book is all its volumes at once)
export const setOrdered = [
  body("volumes").isArray({ min: 1, max: 200 }),
  body("volumes.*").isFloat({ min: 0, max: 999 }).toFloat(),
  body("ordered").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { volumes, ordered } = matchedData(req) as {
      volumes: number[];
      ordered: boolean;
    };
    const manga = res.locals.manga as Manga;
    const others = manga.orderedList.filter((v) => !volumes.includes(v));
    const saved = await mangaQueries.setOrdered(
      manga.id,
      ordered
        ? [...new Set([...others, ...volumes])].sort((a, b) => a - b)
        : others,
    );
    res.json(saved);
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
    // under the reader's lock, as offline changes are (offline/
    // offlineChanges.ts): neither lands in the middle of the other
    const saved = await oneAtATime(req.session.userId!, async () => {
      const now = await mangaQueries.setVolumesOwned(
        manga.id,
        d.ownedList === undefined
          ? keepSavedList(
              manga,
              { volumesOwned: d.volumesOwned ?? null },
              "add one",
            )
          : ownedVolumes(d.volumesOwned ?? null, d.ownedList),
      );
      // a book of the edition they collect that this completed is theirs
      // by name from now on (util/shelf/tickedBooks.ts). The volumes are
      // saved either way
      await recordTickedBooks(
        manga,
        ownedSet(manga),
        ownedSet({ ...manga, ...now }),
      ).catch((e) => console.error(e));
      return now;
    });
    res.json(saved);
  },
];
