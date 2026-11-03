// The shelf: list, add, edit, delete, and the small inline updates (status,
// rating, volumes owned). Every :id route runs requireOwner first, which
// loads the manga onto res.locals.manga.
import { response, type Request, type Response } from "express";
import { body, matchedData, query } from "express-validator";
import { rejectInvalid } from "../middlewares/validate.js";
import mangaQueries, { type MangaInput } from "../models/mangaQueries.js";
import {
  getListingsByMalIds,
  getSeriesInfo,
} from "../prices/anilist.js";
import { findOnShelf, getSeries, getShelfPrices } from "../prices/service.js";
import { canonicalTitle } from "../util/canonicalTitle.js";
import { getCachedReleaseDates, withTimeout } from "../util/releaseCache.js";
import {
  chapterToSave,
  getReleaseStatus,
  readReleaseSettings,
} from "../util/releaseStatus.js";
import userQueries from "../models/userQueries.js";
import {
  namesOf,
  shelfKey,
  toMangaInput,
  type MalEntry,
} from "../util/malEntry.js";
import type { Manga } from "../../generated/prisma/client.js";
import session from "express-session";
import { isOnShelf, titleKey } from "../util/titleKey.js";

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

// answers for anything that would put a title on the shelf twice. Checked in the
// handlers rather than as a validation rule: adding has to check AniList's name for
// it, which is only known after validation, and rules can only answer with a 400
const onShelfAlready = async (
  res: Response,
  userId: number,
  name: string,
  exceptId?: number,
  lightNovel = false,
) => {
  const shelf = await mangaQueries.getMangaShelfNames(userId);
  if (!isOnShelf(name, shelf, exceptId, lightNovel)) return false;
  res.status(409).json({ error: [{ msg: "That's already on your shelf." }] });
  return true;
};

// the validated body as the query layer wants it: blanks become null
const toInput = (req: Request): MangaInput => {
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
    const input = toInput(req);
    // named the way AniList names it, if AniList lists it. If AniList can't be
    // reached the title they typed is fine
    const listing = await getSeriesInfo(input.name).catch(() => null);
    input.name = canonicalTitle(input.name, listing);
    if (
      await onShelfAlready(
        res,
        req.session.userId!,
        input.name,
        undefined,
        Boolean(input.lightNovel),
      )
    )
      return;
    const id = await mangaQueries.addManga(req.session.userId!, input);
    res.status(201).json({ id });
  },
];

// the undo for deleting: everything it had comes back, exactly as it was, so the
// name doesn't go through AniList again. It gets a new id
const restore = [
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
  rejectInvalid,
  async (req: Request, res: Response) => {
    const d = matchedData(req);
    // they may have added it again since deleting it
    if (
      await onShelfAlready(
        res,
        req.session.userId!,
        d.name,
        undefined,
        Boolean(d.lightNovel),
      )
    )
      return;
    const id = await mangaQueries.restoreManga(req.session.userId!, {
      ...toInput(req),
      // validation treats a 0 as blank
      bookmark: d.bookmark ?? (req.body.bookmark === 0 ? 0 : null),
      rating: d.rating ?? null,
      seenVolume: d.seenVolume ?? null,
      seenChapter: d.seenChapter ?? null,
      seenJapanVolume: d.seenJapanVolume ?? null,
      hiddenVolumes: d.hiddenVolumes ?? [],
      latestChapter: d.latestChapter ?? null,
    });
    res.status(201).json({ id });
  },
];

// a piece of a MyAnimeList export. The page sends one piece at a time so a long
// list can show progress and stop safely: anything already here is skipped, so
// trying again after a failure can't add it twice
const IMPORT_PIECE = 50;
const importList = [
  body("entries").isArray({ min: 1, max: IMPORT_PIECE }),
  body("entries.*.malId").optional().isInt({ min: 1 }).toInt(),
  body("entries.*.title").isString().trim().isLength({ min: 1, max: 300 }),
  body("entries.*.finished").isBoolean().toBoolean(),
  body("entries.*.chapters").isInt({ min: 0, max: 100000 }).toInt(),
  body("entries.*.readVolumes").isInt({ min: 0, max: 999 }).toInt(),
  body("entries.*.ownedVolumes").isInt({ min: 0, max: 999 }).toInt(),
  body("entries.*.score").isInt({ min: 0, max: 10 }).toInt(),
  body("entries.*.comments").optional().isString(),
  body("entries.*.planned").optional().isBoolean().toBoolean(),
  body("entries.*.lightNovel").optional().isBoolean().toBoolean(),
  // only AniList's and Kitsu's own image servers, so an import can't point covers
  // anywhere else
  body("entries.*.cover")
    .optional()
    .isURL({ protocols: ["https"], require_protocol: true })
    .matches(/^https:\/\/(s4\.anilist\.co|media\.kitsu\.(app|io))\//),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const entries: MalEntry[] = matchedData(req).entries;
    const shelf = await mangaQueries.getShelf(userId);
    const taken = new Set(
      shelf.map((m) => shelfKey(titleKey(m.name), m.lightNovel)),
    );
    const listings = await getListingsByMalIds(
      entries.flatMap((e) => (e.malId ? [e.malId] : [])),
    );

    const inputs = [];
    let alreadyThere = 0;
    let noCover = 0;
    for (const entry of entries) {
      const listing = (entry.malId && listings.get(entry.malId)) || null;
      const names = namesOf(entry, listing);
      if (names.some((name) => taken.has(name))) {
        alreadyThere++;
        continue;
      }
      names.forEach((name) => taken.add(name));
      const input = toMangaInput(entry, listing);
      // the shelf's titles stop at 150 characters
      inputs.push({ ...input, name: input.name.slice(0, 150) });
      if (!input.image) noCover++;
    }
    if (inputs.length) await mangaQueries.addManyManga(userId, inputs);
    res.json({ added: inputs.length, alreadyThere, noCover });
  },
];

const SERIES_TIMEOUT_MS = 25_000;
const INFO_TIMEOUT_MS = 10_000;

const detail = (_req: Request, res: Response) => {
  res.json({ manga: res.locals.manga });
};

// release dates and what's new in English for one manga. Its own route because
// it can be slow, so the details page and the edit form don't wait for it
const releases = async (req: Request, res: Response) => {
  const manga: Manga = res.locals.manga;
  // a problem here just means the default list
  const prefs = await userQueries
    .getPrefs(req.session.userId!)
    .catch(() => null);
  // switched off in settings: no other site gets asked about this manga. Light
  // novels aren't looked up yet: the catalog and MangaUpdates only know the
  // manga, whose news would be wrong for them
  if (prefs?.releaseChecks === "off" || manga.lightNovel) {
    return res.json({ releaseData: null, releaseStatus: null, complete: true });
  }
  // asked apart: AniList confirms which series this is on MangaDex, and is
  // usually answered from the database even when the catalog is being slow
  const [info, series] = await Promise.all([
    withTimeout(
      getSeriesInfo(manga.name).catch(() => null),
      INFO_TIMEOUT_MS,
      null,
    ),
    // a catalog failure or a slow one only costs the volume half of the answer;
    // if it's slow it carries on and is ready for the next check
    withTimeout(
      getSeries(manga.name).catch(() => null),
      SERIES_TIMEOUT_MS,
      null,
    ),
  ]);
  const dates = await getCachedReleaseDates(manga.name, {
    anilistId: info?.anilistId,
    altNames: info?.altNames,
  });
  const releaseData = dates.ok && dates.data ? dates.data : null;
  if (!releaseData && !series) {
    return res.json({
      releaseData: null,
      releaseStatus: null,
      complete: false,
    });
  }
  const releaseStatus = getReleaseStatus(
    manga,
    { dates: releaseData, englishVolumes: series?.volumes ?? null },
    readReleaseSettings(prefs?.releases),
  );
  // kept on the manga, so progress can show straight away next time. Failing to
  // save it shouldn't cost them the answer
  const newLatest = chapterToSave(
    releaseStatus.latestChapter,
    manga.latestChapter,
  );
  if (newLatest != null) {
    await mangaQueries
      .setLatestChapter(manga.id, newLatest)
      .catch((e) => console.error("Couldn't save the latest chapter:", e));
  }
  return res.json({
    releaseData,
    releaseStatus,
    // a source didn't answer, so it's worth asking again later
    complete: Boolean(releaseData && series),
  });
};

const update = [
  ...mangaFields,
  rejectInvalid,
  async (req: Request, res: Response) => {
    const input = toInput(req);
    const { id, lightNovel } = res.locals.manga as Manga;
    if (
      await onShelfAlready(
        res,
        req.session.userId!,
        input.name,
        id,
        input.lightNovel ?? lightNovel,
      )
    )
      return;
    await mangaQueries.updateManga(id, input);
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

const setPlanned = [
  body("planned").isBoolean().toBoolean(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await mangaQueries.setPlanned(res.locals.manga.id, matchedData(req).planned);
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

// the chapter they're on, from the steppers on the details page
const setBookmark = [
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

// "Hide" on the New tab, and its undo. Null clears it. Volumes can also be hidden
// one at a time, sent as the whole list; leaving it out keeps the list as it is
const setSeen = [
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

// typed straight on the details page. Only touches the notes, and empty clears them
const setNotes = [
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
      volumesOwned: await mangaQueries.setVolumesOwned(
        res.locals.manga.id,
        value,
      ),
    });
  },
];

// the cheapest known price for each manga on the shelf, for the cards
const shelfPrices = async (req: Request, res: Response) => {
  const manga = await mangaQueries.getShelf(req.session.userId!);
  res.json(
    await getShelfPrices(manga.map((m) => ({ id: m.id, name: m.name }))),
  );
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
  releases,
  update,
  remove,
  setStatus,
  setPlanned,
  setRating,
  importList,
  setBookmark,
  setSeen,
  restore,
  setNotes,
  setOwned,
  shelfPrices,
  match,
};
