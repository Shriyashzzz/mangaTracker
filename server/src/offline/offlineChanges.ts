// Changes made on the installed app with no connection, sent when it's back
// (client lib/offlineChanges.ts keeps them): the volumes ticked on a series'
// shelf, and the chapter or volume read. Each is put together with what the
// server has now by offlineRules.ts, so another device's changes since are
// never undone. One answer for each change, in order.
import { body, matchedData } from "express-validator";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { rejectInvalid } from "../middlewares/validate.js";
import mangaQueries from "../models/mangaQueries.js";
import { ownedSet } from "../collector/shelfMath.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { askAboutFinishedVolume } from "../reviews/reviews.js";
import { newestChapterKnown } from "../util/releases/releaseAnswers.js";
import { PAST_THE_NEWEST } from "../controllers/manga/shelf.js";
import { mergeOwned, mergePlace } from "./offlineRules.js";
import { oneAtATime } from "../util/shelf/oneAtATime.js";

// plenty for a day underground; one request stays small
export const MOST_CHANGES = 200;

type Change =
  | { kind: "owned"; mangaId: number; started: number[]; ended: number[] }
  | { kind: "bookmark"; mangaId: number; from: number | null; to: number }
  | {
      kind: "readVolume";
      mangaId: number;
      from: number | null;
      to: number | null;
    };

export type ChangeAnswer =
  | { saved: true }
  // the series isn't on their shelf now (deleted on another device)
  | { saved: false; reason: "gone" | "pastNewest" };

// an owned change's volumes: where they started and where they ended up
const volumeList = (field: string) => [
  body(`changes.*.${field}`).optional().isArray({ max: 999 }),
  body(`changes.*.${field}.*`).isFloat({ min: 0, max: 999 }).toFloat(),
];
const place = (field: string, max: number) =>
  body(`changes.*.${field}`)
    .optional({ values: "null" })
    .isInt({ min: 0, max })
    .toInt();

export const applyOfflineChanges = [
  body("changes").isArray({ min: 1, max: MOST_CHANGES }),
  body("changes.*.kind").isIn(["owned", "bookmark", "readVolume"]),
  body("changes.*.mangaId").isInt({ min: 1 }).toInt(),
  ...volumeList("started"),
  ...volumeList("ended"),
  place("from", 100000),
  place("to", 100000),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const { changes } = matchedData(req) as { changes: Change[] };
    const answers: ChangeAnswer[] = [];
    // one at a time, in the order they were made, and under the reader's
    // lock (util/shelf/oneAtATime.ts): owned volumes are read, merged and
    // written, so a tick saved from another device mid-way can't be lost
    await oneAtATime(userId, async () => {
      for (const change of changes)
        answers.push(await applyOne(userId, change));
    });
    res.json({ answers });
  },
];

async function applyOne(userId: number, change: Change): Promise<ChangeAnswer> {
  const manga = await prisma.manga.findFirst({
    where: { id: change.mangaId, userId },
  });
  if (!manga) return { saved: false, reason: "gone" };

  if (change.kind === "owned") {
    const now = [...ownedSet(manga)];
    const merged = mergeOwned(now, change.started ?? [], change.ended ?? []);
    await mangaQueries.setVolumesOwned(manga.id, ownedVolumes(null, merged));
    return { saved: true };
  }
  if (change.kind === "bookmark") {
    const to = mergePlace(manga.bookmark, change.from, change.to) ?? 0;
    // the same slip-of-the-finger check as a chapter saved online
    const newest = await newestChapterKnown(manga.id);
    if (newest != null && to > newest + PAST_THE_NEWEST)
      return { saved: false, reason: "pastNewest" };
    await mangaQueries.setBookmark(manga.id, to);
    return { saved: true };
  }
  const to = mergePlace(manga.readVolume, change.from, change.to);
  if (to != null && to > 999) return { saved: false, reason: "pastNewest" };
  await mangaQueries.setReading(manga, { readVolume: to });
  if ((to ?? 0) > (manga.readVolume ?? 0))
    await askAboutFinishedVolume(userId, manga.id);
  return { saved: true };
}
