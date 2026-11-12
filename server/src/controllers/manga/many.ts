// Several series at once: the shelf's Select (delete and move many) and every
// undo (restore one, restore many, put many back where they were).
import type { Request, Response } from "express";
import { body, matchedData, validationResult } from "express-validator";
import { rejectInvalid } from "../../middlewares/validate.js";
import { sendError } from "../../middlewares/errorHandler.js";
import mangaQueries, { type RestoredManga } from "../../models/mangaQueries.js";
import { shelfKey } from "../../util/shelf/malEntry.js";
import { titleKey } from "../../util/shelf/titleKey.js";
import { oneAtATime } from "../../util/shelf/oneAtATime.js";
import { onShelfAlready, restoreFields, restoredInput } from "./fields.js";

// the undo for deleting: everything it had comes back, exactly as it was, so the
// name doesn't go through AniList again. It gets a new id
export const restore = [
  ...restoreFields,
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
      const id = await mangaQueries.restoreManga(userId, restoredInput(req));
      res.status(201).json({ id });
    });
  },
];

// the shelf's Select can pick a whole shelf, so a delete takes this many ids
// (a small request even then). The undo comes back in pieces of 200
// (client/src/store/shelf.ts), well under this
const MOST_DELETED = 10_000;

const MOST_RESTORED = 1000;

// several of their series deleted at once, all or none. Only their own: an id
// that isn't theirs is left alone, whoever it belongs to
export const removeMany = [
  body("ids")
    .isArray({ min: 1, max: MOST_DELETED })
    .withMessage(`Pick between 1 and ${MOST_DELETED} series.`),
  body("ids.*").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const ids = [...new Set(matchedData(req).ids as number[])];
    const manga = await mangaQueries.deleteManyManga(req.session.userId!, ids);
    // what went, as it was: the undo puts back exactly this
    res.json({ deleted: manga.length, manga });
  },
];

// the shelf's Select: several to Finished, To read or Reading at once
export const moveMany = [
  body("ids")
    .isArray({ min: 1, max: MOST_DELETED })
    .withMessage(`Pick between 1 and ${MOST_DELETED} series.`),
  body("ids.*").isInt({ min: 1 }).toInt(),
  body("to").isIn(["finished", "planned", "reading"]),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const { ids, to } = matchedData(req);
    const was = await mangaQueries.moveManyManga(
      req.session.userId!,
      [...new Set(ids as number[])],
      to,
    );
    // where they were: the undo puts each back there
    res.json({ moved: was.length, was });
  },
];

// that move's undo, sent in pieces: 10,000 places is more than a request holds
const MOST_PLACED = 2000;

export const placeMany = [
  body("places")
    .isArray({ min: 1, max: MOST_PLACED })
    .withMessage(`Between 1 and ${MOST_PLACED} series.`),
  body("places.*.id").isInt({ min: 1 }).toInt(),
  body("places.*.status").isBoolean({ strict: true }),
  body("places.*.planned").isBoolean({ strict: true }),
  body("places.*.bookmark")
    .optional({ values: "null" })
    .isInt({ min: 0, max: 100000 })
    .toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const places = (
      matchedData(req).places as {
        id: number;
        status: boolean;
        planned: boolean;
        bookmark?: number | null;
      }[]
    ).map((p) => ({
      id: p.id,
      status: p.status,
      // never both, as everywhere else
      planned: p.planned && !p.status,
      bookmark: p.bookmark ?? null,
    }));
    const placed = await mangaQueries.placeManyManga(
      req.session.userId!,
      places,
    );
    res.json({ placed });
  },
];

// one series sent to the undo, checked by restore's own rules. Null when it
// doesn't pass them
export async function checkRestored(
  item: unknown,
): Promise<RestoredManga | null> {
  const req = {
    body: item && typeof item === "object" ? item : {},
  } as Request;
  for (const chain of restoreFields) await chain.run(req);
  if (!validationResult(req).isEmpty()) return null;
  return restoredInput(req);
}

// the series that can come back: not already on the shelf (added again since),
// and not twice in the list
export function notOnShelf(
  inputs: RestoredManga[],
  shelf: { id: number; name: string; lightNovel?: boolean }[],
) {
  // each title keyed once, not once per series checked
  const keyOf = (name: string, lightNovel?: boolean) =>
    shelfKey(titleKey(name), Boolean(lightNovel));
  const taken = new Set(shelf.map((m) => keyOf(m.name, m.lightNovel)));
  const fresh: RestoredManga[] = [];
  for (const input of inputs) {
    const key = keyOf(input.name, input.lightNovel);
    if (taken.has(key)) continue;
    fresh.push(input);
    taken.add(key);
  }
  return fresh;
}

// the undo for a Select delete: every series back as it was, in one go
export const restoreMany = [
  body("manga")
    .isArray({ min: 1, max: MOST_RESTORED })
    .withMessage(`Between 1 and ${MOST_RESTORED} series at a time.`),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const checked = await Promise.all(
      (req.body.manga as unknown[]).map(checkRestored),
    );
    const inputs = checked.filter((m): m is RestoredManga => m !== null);
    const invalid = checked.length - inputs.length;
    await oneAtATime(userId, async () => {
      const fresh = notOnShelf(
        inputs,
        await mangaQueries.getMangaShelfNames(userId),
      );
      if (fresh.length) await mangaQueries.addManyManga(userId, fresh);
      res.json({
        restored: fresh.length,
        alreadyThere: inputs.length - fresh.length,
        invalid,
      });
    });
  },
];

// POST /:id/merge {otherId}: the same series on the shelf twice becomes one
// (mangaQueries.mergeManga). Both theirs: the other is checked here, the first
// by requireOwner
export const merge = [
  body("otherId").isInt({ min: 1 }).toInt(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const otherId: number = matchedData(req).otherId;
    const keep = res.locals.manga.id as number;
    const other = await mangaQueries.getManga(otherId);
    if (!other || other.userId !== req.session.userId || otherId === keep) {
      sendError(res, 404, "That one isn't on your shelf.");
      return;
    }
    await mangaQueries.mergeManga(keep, otherId);
    res.sendStatus(204);
  },
];
