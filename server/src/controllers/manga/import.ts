// Bringing a list in: the import itself, finding a title on the shelf, and the
// import matches readers share so the next import of the same title is quicker.
import type { Request, Response } from "express";
import { body, matchedData, query } from "express-validator";
import { rejectInvalid } from "../../middlewares/validate.js";
import mangaQueries from "../../models/mangaQueries.js";
import { getListingsByMalIds } from "../../prices/sources/anilist.js";
import { findOnShelf } from "../../prices/service.js";
import { isNovelName, priceName } from "../../prices/lightNovel.js";
import {
  entryIsLightNovel,
  namesOf,
  shelfKey,
  toMangaInput,
  backupFill,
  type MalEntry,
} from "../../util/shelf/malEntry.js";
import { titleKey } from "../../util/shelf/titleKey.js";
import { oneAtATime } from "../../util/shelf/oneAtATime.js";
import { knownMatches, tellMatches } from "../../util/shelf/sharedMatches.js";
import { ownedListFields } from "./fields.js";
import { ownedVolumes } from "../../util/shelf/ownedList.js";

// every volume a series says it owns: the exact list, or 1 to "up to"
const ownedSetOf = (volumesOwned: number | null, list: number[]) =>
  list.length
    ? list
    : Array.from({ length: volumesOwned ?? 0 }, (_, i) => i + 1);

// a piece of a MyAnimeList export. The page sends one piece at a time so a long
// list can show progress and stop safely: anything already here is skipped, so
// trying again after a failure can't add it twice
const IMPORT_PIECE = 50;

export const importList = [
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
  body("entries.*.restore").optional().isBoolean().toBoolean(),
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
      const onShelf = new Map<string, typeof shelf>();
      for (const m of shelf) {
        const key = titleKey(m.name);
        onShelf.set(key, [...(onShelf.get(key) ?? []), m]);
      }
      // within this import the manga and the light novel of a series both come in
      const taken = new Set<string>();

      const inputs = [];
      let alreadyThere = 0;
      let noCover = 0;
      // already there, but the import owns volumes the shelf doesn't: those
      // are added (never taken away), so a new purchase can be imported
      const merges = new Map<
        number,
        { volumesOwned: number | null; ownedList: number[] }
      >();
      // a backup's chapter, status, rating and notes, where the shelf lacks them
      const fills = new Map<
        number,
        NonNullable<ReturnType<typeof backupFill>>
      >();
      for (const entry of entries) {
        const listing = (entry.malId && listings.get(entry.malId)) || null;
        const names = namesOf(entry, listing);
        const lightNovel = entryIsLightNovel(entry, listing);
        const cover = listing?.cover ?? entry.cover ?? null;
        const keys = names.map((name) => shelfKey(name, lightNovel));
        const existing = names
          .flatMap((name) => onShelf.get(name) ?? [])
          .find(
            (m) =>
              Boolean(m.lightNovel) === lightNovel ||
              (cover && m.image === cover),
          );
        if (existing || keys.some((key) => taken.has(key))) {
          alreadyThere++;
          if (existing) {
            const had = merges.get(existing.id) ?? {
              volumesOwned: existing.volumesOwned,
              ownedList: existing.ownedList,
            };
            const before = ownedSetOf(had.volumesOwned, had.ownedList);
            const incoming = ownedSetOf(
              entry.ownedVolumes || null,
              entry.ownedList ?? [],
            );
            const all = [...new Set([...before, ...incoming])];
            if (all.length > before.length)
              merges.set(existing.id, ownedVolumes(null, all));
            const fill = entry.restore ? backupFill(entry, existing) : null;
            if (fill) fills.set(existing.id, fill);
          }
          continue;
        }
        keys.forEach((key) => taken.add(key));
        const input = toMangaInput(entry, listing);
        // the shelf's titles stop at 150 characters
        inputs.push({ ...input, name: input.name.slice(0, 150) });
        if (!input.image) noCover++;
      }
      if (inputs.length) await mangaQueries.addManyManga(userId, inputs);
      for (const [id, owned] of merges)
        await mangaQueries.setVolumesOwned(id, owned);
      for (const [id, fill] of fills)
        await mangaQueries.fillFromBackup(id, fill);
      res.json({
        added: inputs.length,
        alreadyThere,
        // of those already there, how many got volumes they didn't have
        volumesAdded: new Set([...merges.keys(), ...fills.keys()]).size,
        noCover,
      });
    });
  },
];

// is this series on the shelf? For the volume page's shelf button
export const match = [
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
export const knownImportMatches = [
  ...searchFields("searches"),
  rejectInvalid,
  async (req: Request, res: Response) => {
    res.json({ matches: await knownMatches(matchedData(req).searches) });
  },
];

// after: the matches this import found, checked before anyone else gets them
export const tellImportMatches = [
  ...searchFields("matches"),
  body("matches.*.anilistId").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    await tellMatches(matchedData(req).matches);
    res.status(202).json({ ok: true });
  },
];
