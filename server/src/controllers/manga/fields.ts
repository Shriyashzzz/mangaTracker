// Validation the shelf's routes share: a series' fields for add and edit,
// the exact volumes owned, an undo's restored series, and the check that a
// title isn't on the shelf already.
import type { Request, Response } from "express";
import { body, matchedData } from "express-validator";
import mangaQueries, {
  type MangaInput,
  type RestoredManga,
} from "../../models/mangaQueries.js";
import { onShelfAs } from "../../util/shelf/titleKey.js";
import { ownedVolumes } from "../../util/shelf/ownedList.js";

// the exact volumes owned, as numbers like 4 or 10.5
export const ownedListFields = (field: string) => [
  body(field).optional().isArray({ max: 999 }),
  body(`${field}.*`)
    .isFloat({ min: 0, max: 999 })
    .withMessage("Volume numbers go from 0 to 999")
    .toFloat(),
];

// ---------- validation shared by add and edit ----------
export const mangaFields = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Manga title cannot be empty luv <3")
    // short titles are real ("86", "K"), and imports bring them in
    .isLength({ max: 150 })
    .withMessage("Titles can be up to 150 characters long! <3"),
  body("bookmark")
    .optional({ values: "falsy" })
    .isInt({ min: 0, max: 100000 })
    .withMessage("Bookmark has to be a number luv!")
    .toInt(),
  body("status")
    .isBoolean()
    .withMessage("Status is reading or done")
    .toBoolean(),
  // want to read: not started, so no chapter needed
  body("planned").optional().isBoolean().toBoolean(),
  // a light novel rather than a manga
  body("lightNovel").optional().isBoolean().toBoolean(),
  // the last volume they own; blank (or 0) means they don't say
  body("volumesOwned")
    .optional({ values: "falsy" })
    .isInt({ min: 0, max: 999 })
    .withMessage("Volumes owned has to be a whole number, like 14")
    .toInt(),
  // or exactly which: One Piece 1 and 4 (util/shelf/ownedList.ts)
  ...ownedListFields("ownedList"),
  body("genre").optional({ values: "falsy" }).trim().isLength({ max: 100 }),
  // stars given on adding it; editing doesn't send them (the details page
  // rates on its own), so it's left alone there
  body("rating")
    .optional({ values: "null" })
    .isInt({ min: 0, max: 5 })
    .withMessage("0 to 5 stars")
    .toInt(),
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

// answers for anything that would put a title on the shelf twice. Checked in the
// handlers rather than as a validation rule: adding has to check AniList's name for
// it, which is only known after validation, and rules can only answer with a 400
export const onShelfAlready = async (
  res: Response,
  userId: number,
  name: string,
  // an edit can keep its own name; the manga and the light novel can both be there
  {
    exceptId,
    lightNovel = false,
  }: { exceptId?: number; lightNovel?: boolean } = {},
) => {
  const shelf = await mangaQueries.getMangaShelfNames(userId);
  const existing = onShelfAs(name, shelf, exceptId, lightNovel);
  if (!existing) return false;
  // which one, so a barcode scan can mark its volume there instead
  res.status(409).json({
    error: [{ msg: "That's already on your shelf." }],
    id: existing.id,
  });
  return true;
};

// the validated body as the query layer wants it: blanks become null
export const toInput = (req: Request): MangaInput => {
  const d = matchedData(req);
  return {
    name: d.name,
    // to read and finished can't both be true
    status: d.planned ? false : d.status,
    // left alone when the form doesn't say, so editing keeps it on the list
    planned: d.planned === undefined ? undefined : Boolean(d.planned),
    // the same: an edit that doesn't say keeps what it was
    lightNovel: d.lightNovel === undefined ? undefined : Boolean(d.lightNovel),
    bookmark: d.planned ? null : d.bookmark || null,
    ...ownedVolumes(d.volumesOwned, d.ownedList),
    genre: d.genre || null,
    description: d.description || null,
    image: d.image || null,
    ...(d.rating ? { rating: d.rating } : {}),
  };
};

// ---------- handlers ----------

// what an undo brings back, checked the same way for one series or many
export const restoreFields = [
  ...mangaFields,
  body("rating").optional({ values: "null" }).isInt({ min: 0, max: 5 }).toInt(),
  body("seenVolume").optional({ values: "null" }).isFloat({ min: 0 }).toFloat(),
  body("seenChapter")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .toFloat(),
  body("seenJapanVolume")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .toFloat(),
  body("hiddenVolumes").optional().isArray({ max: 500 }),
  body("hiddenVolumes.*").isFloat({ min: 0, max: 100000 }).toFloat(),
  body("latestChapter")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .toFloat(),
];

export const restoredInput = (req: Request): RestoredManga => {
  const d = matchedData(req);
  return {
    ...toInput(req),
    // validation treats a 0 as blank
    bookmark: d.bookmark ?? (req.body.bookmark === 0 ? 0 : null),
    rating: d.rating ?? null,
    seenVolume: d.seenVolume ?? null,
    seenChapter: d.seenChapter ?? null,
    seenJapanVolume: d.seenJapanVolume ?? null,
    hiddenVolumes: d.hiddenVolumes ?? [],
    latestChapter: d.latestChapter ?? null,
  };
};
