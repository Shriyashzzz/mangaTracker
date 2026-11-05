// The shelf: list, add, edit, delete, and the small inline updates (status,
// rating, volumes owned). Every :id route runs requireOwner first, which
// loads the manga onto res.locals.manga.
import {
  mangaOutcome,
  type ReleaseOutcome,
} from "../util/releases/releaseOutcome.js";
import type { Request, Response } from "express";
import { body, matchedData, query } from "express-validator";
import { rejectInvalid } from "../middlewares/validate.js";
import mangaQueries, { type MangaInput } from "../models/mangaQueries.js";
import {
  getListingsByMalIds,
  getSeriesInfo,
} from "../prices/sources/anilist.js";
import { findOnShelf, getSeries, getShelfPrices } from "../prices/service.js";
import { isNovelName, novelName, priceName } from "../prices/lightNovel.js";
import { canonicalTitle } from "../util/shelf/canonicalTitle.js";
import {
  getCachedReleaseDates,
  withTimeout,
} from "../util/releases/releaseCache.js";
import {
  chapterToSave,
  getReleaseStatus,
  readReleaseSettings,
} from "../util/releases/releaseStatus.js";
import userQueries from "../models/userQueries.js";
import {
  entryIsLightNovel,
  namesOf,
  shelfKey,
  toMangaInput,
  type MalEntry,
} from "../util/shelf/malEntry.js";
import type { Manga } from "../../generated/prisma/client.js";
import { isOnShelf, titleKey } from "../util/shelf/titleKey.js";
import { oneAtATime } from "../util/shelf/oneAtATime.js";
import { knownMatches, tellMatches } from "../util/shelf/sharedMatches.js";
import { keepSavedList, ownedVolumes } from "../util/shelf/ownedList.js";

// the exact volumes owned, as numbers like 4 or 10.5
const ownedListFields = (field: string) => [
  body(field).optional().isArray({ max: 999 }),
  body(`${field}.*`)
    .isFloat({ min: 0, max: 999 })
    .withMessage("Volume numbers go from 0 to 999")
    .toFloat(),
];

// ---------- validation shared by add and edit ----------
const mangaFields = [
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
  // an edit can keep its own name; the manga and the light novel can both be there
  {
    exceptId,
    lightNovel = false,
  }: { exceptId?: number; lightNovel?: boolean } = {},
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
    ...ownedVolumes(d.volumesOwned, d.ownedList),
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
    const userId = req.session.userId!;
    await oneAtATime(userId, async () => {
      // they may have added it again since deleting it
      if (
        await onShelfAlready(res, userId, d.name, {
          lightNovel: Boolean(d.lightNovel),
        })
      )
        return;
      const id = await mangaQueries.restoreManga(userId, {
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
    });
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
  // which ones exactly, when a book app's export says (One Piece 1 and 4)
  ...ownedListFields("entries.*.ownedList"),
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
    // AniList first: it's slow, and nothing else of theirs waits for it
    const listings = await getListingsByMalIds(
      entries.flatMap((e) => (e.malId ? [e.malId] : [])),
    );
    await oneAtATime(userId, async () => {
      const shelf = await mangaQueries.getShelf(userId);
      // already there: the same name in the same format, or with the same AniList
      // cover. Light novels imported before the format was kept are saved as
      // manga, and the cover is what gives them away, so trying again can't add
      // them twice while the manga of the same name can still come in
      const onShelf = new Map<
        string,
        { lightNovel: boolean; image: string | null }[]
      >();
      for (const m of shelf) {
        const key = titleKey(m.name);
        onShelf.set(key, [...(onShelf.get(key) ?? []), m]);
      }
      // within this import the manga and the light novel of a series both come in
      const taken = new Set<string>();

      const inputs = [];
      let alreadyThere = 0;
      let noCover = 0;
      for (const entry of entries) {
        const listing = (entry.malId && listings.get(entry.malId)) || null;
        const names = namesOf(entry, listing);
        const lightNovel = entryIsLightNovel(entry, listing);
        const cover = listing?.cover ?? entry.cover ?? null;
        const keys = names.map((name) => shelfKey(name, lightNovel));
        const there = names.some((name) =>
          (onShelf.get(name) ?? []).some(
            (m) => m.lightNovel === lightNovel || (cover && m.image === cover),
          ),
        );
        if (there || keys.some((key) => taken.has(key))) {
          alreadyThere++;
          continue;
        }
        keys.forEach((key) => taken.add(key));
        const input = toMangaInput(entry, listing);
        // the shelf's titles stop at 150 characters
        inputs.push({ ...input, name: input.name.slice(0, 150) });
        if (!input.image) noCover++;
      }
      if (inputs.length) await mangaQueries.addManyManga(userId, inputs);
      res.json({ added: inputs.length, alreadyThere, noCover });
    });
  },
];

const SERIES_TIMEOUT_MS = 25_000;
const INFO_TIMEOUT_MS = 10_000;

const detail = (_req: Request, res: Response) => {
  res.json({ manga: res.locals.manga });
};

// a series that can't have news: AniList says it has finished, and they own
// as many volumes as it has (its count is Japan's, so every English one too).
// Finished reading isn't enough on its own: that's them, not the series
export const nothingLeftToCheck = (
  manga: Pick<Manga, "volumesOwned"> & { ownedList?: number[] },
  info: { status?: string | null; volumes?: number | null } | null,
) =>
  info?.status === "FINISHED" &&
  Boolean(info.volumes) &&
  // with gaps, as many as it has, not just one numbered as high
  (manga.ownedList?.length
    ? manga.ownedList.filter(Number.isInteger).length
    : (manga.volumesOwned ?? 0)) >= info.volumes!;

// release dates and what's new in English for one manga. Its own route because
// it can be slow, so the details page and the edit form don't wait for it.
// The shelf says which lane (?lane=now or later) and skips what has nothing
// left to check; the details page always asks, in "now"
const releases = async (req: Request, res: Response) => {
  const manga: Manga = res.locals.manga;
  const lane = req.query.lane === "later" ? "later" : "now";
  const fromShelf = req.query.lane === "now" || req.query.lane === "later";
  // a problem here just means the default list
  const prefs = await userQueries
    .getPrefs(req.session.userId!)
    .catch(() => null);
  // no news to give, and why: only "failed" is worth asking again, and only
  // it means the sites didn't answer (the shelf says so if every check failed)
  const nothing = (outcome: Exclude<ReleaseOutcome, "news">) =>
    res.json({
      releaseData: null,
      releaseStatus: null,
      complete: outcome !== "failed",
      outcome,
    });
  // switched off in settings: no other site gets asked about this manga
  if (prefs?.releaseChecks === "off") return nothing("off");
  // a light novel's news is its English volumes alone: MangaDex, where the
  // chapters and Japanese volumes come from, only has the manga
  if (manga.lightNovel) {
    // side by side: a novel's check is only its catalog list, so waiting on
    // AniList first would only make it slower
    const [novelInfo, series] = await Promise.all([
      fromShelf
        ? withTimeout(
            getSeriesInfo(novelName(manga.name)).catch(() => null),
            INFO_TIMEOUT_MS,
            null,
          )
        : null,
      // not found is an answer; failing or being slow is worth asking again
      withTimeout(
        getSeries(novelName(manga.name)).catch(() => undefined),
        SERIES_TIMEOUT_MS,
        undefined,
      ),
    ]);
    if (fromShelf && nothingLeftToCheck(manga, novelInfo)) {
      return nothing("skipped");
    }
    if (!series) return nothing(series === null ? "notFound" : "failed");
    return res.json({
      releaseData: null,
      releaseStatus: getReleaseStatus(
        manga,
        { dates: null, englishVolumes: series.volumes },
        readReleaseSettings(prefs?.releases),
      ),
      complete: true,
      outcome: "news",
    });
  }
  // the catalog right away for the details page, which never skips; the shelf
  // waits on AniList first, as a finished series it owns needs neither
  // null: the catalog doesn't have it; undefined: it failed or was slow
  const startSeries = () =>
    withTimeout(
      getSeries(manga.name).catch(() => undefined),
      SERIES_TIMEOUT_MS,
      undefined,
    );
  const seriesEarly = fromShelf ? undefined : startSeries();
  // AniList: it confirms which series this is on MangaDex, says whether it has
  // finished, and is usually answered from the database
  const info = await withTimeout(
    getSeriesInfo(manga.name).catch(() => null),
    INFO_TIMEOUT_MS,
    null,
  );
  if (fromShelf && nothingLeftToCheck(manga, info)) return nothing("skipped");
  // a catalog failure or a slow one only costs the volume half of the answer;
  // if it's slow it carries on and is ready for the next check
  const [series, dates] = await Promise.all([
    seriesEarly ?? startSeries(),
    getCachedReleaseDates(
      manga.name,
      { anilistId: info?.anilistId, altNames: info?.altNames },
      lane,
    ),
  ]);
  const releaseData = dates.ok && dates.data ? dates.data : null;
  const { outcome, complete } = mangaOutcome(
    { ok: dates.ok, hasData: Boolean(releaseData) },
    series,
  );
  if (outcome !== "news") return nothing(outcome);
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
    complete,
    outcome,
  });
};

const update = [
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
    await mangaQueries.setPlanned(
      res.locals.manga.id,
      matchedData(req).planned,
    );
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
// "up to" a volume (null clears it), or the exact list
const setOwned = [
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

// the cheapest known price for each manga on the shelf, for the cards. A light
// novel is priced as the novel, never as the manga of the same name
const shelfPrices = async (req: Request, res: Response) => {
  const manga = await mangaQueries.getShelf(req.session.userId!);
  res.json(
    await getShelfPrices(manga.map((m) => ({ id: m.id, name: priceName(m) }))),
  );
};

// is this series on the shelf? For the volume page's shelf button
const match = [
  query("series").trim().isLength({ min: 2, max: 150 }),
  rejectInvalid,
  async (req: Request, res: Response) => {
    // the series asked about is the manga's or, named "… Light Novel", the
    // novel's: each only finds itself on the shelf
    const series: string = matchedData(req).series;
    const manga = (await mangaQueries.getShelf(req.session.userId!))
      .filter((m) => Boolean(m.lightNovel) === isNovelName(series))
      .map((m) => ({ ...m, shelfName: m.name, name: priceName(m) }));
    const found = await findOnShelf(manga, series);

    res.json(
      found && {
        id: found.id,
        name: found.shelfName,
        bookmark: found.bookmark,
        status: found.status,
        planned: found.planned,
        volumesOwned: found.volumesOwned,
        ownedList: found.ownedList,
      },
    );
  },
];

// ---------- the book import's shared matches (util/shelf/sharedMatches.ts) ----------

const MAX_SEARCHES = 500;
const searchFields = (list: string) => [
  body(list).isArray({ min: 1, max: MAX_SEARCHES }),
  body(`${list}.*.name`).isString().trim().isLength({ min: 1, max: 200 }),
  body(`${list}.*.lightNovel`).isBoolean({ strict: true }),
  body(`${list}.*.exactOnly`).isBoolean({ strict: true }),
];

// before matching: which of these titles everyone's imports already know
const knownImportMatches = [
  ...searchFields("searches"),
  rejectInvalid,
  async (req: Request, res: Response) => {
    res.json({ matches: await knownMatches(matchedData(req).searches) });
  },
];

// after: the matches this import found, checked before anyone else gets them
const tellImportMatches = [
  ...searchFields("matches"),
  body("matches.*.anilistId").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await tellMatches(matchedData(req).matches);
    res.status(202).json({ ok: true });
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
  knownImportMatches,
  tellImportMatches,
};
