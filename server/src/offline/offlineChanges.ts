// Changes made on the installed app with no connection, sent when it's back
// (client lib/offlineChanges.ts keeps them): the volumes ticked on a series'
// shelf, the chapter or volume read, finished or not and To read (one
// change, the series' state), the rating and the notes. Each is put together with what the
// server has now by offlineRules.ts, so another device's changes since are
// never undone. One answer for each change, in order.
import { body, matchedData } from "express-validator";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { rejectInvalid } from "../middlewares/validate.js";
import mangaQueries from "../models/mangaQueries.js";
import { readersDay, recordTickedBooks } from "../util/shelf/tickedBooks.js";
import { ownedSet } from "../collector/shelfMath.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { askAboutFinishedVolume } from "../reviews/reviews.js";
import { newestChapterKnown } from "../util/releases/releaseAnswers.js";
import { PAST_THE_NEWEST } from "../controllers/manga/shelf.js";
import {
  mergeNotes,
  mergeOwned,
  mergePlace,
  mergeState,
  mergeValue,
  sameState,
  readChange,
  type Change,
} from "./offlineRules.js";
import { oneAtATime } from "../util/shelf/oneAtATime.js";

// plenty for a day underground; one request stays small
export const MOST_CHANGES = 200;

export type ChangeAnswer =
  | { saved: true }
  // the series isn't on their shelf now (deleted on another device)
  | { saved: false; reason: "gone" | "pastNewest" };

export const applyOfflineChanges = [
  body("changes").isArray({ min: 1, max: MOST_CHANGES }),
  // each checked by its kind (offlineRules.ts readChange)
  body("changes.*")
    .customSanitizer(readChange)
    .custom((change) => change !== null)
    .withMessage("That isn't a change."),
  // their own day, "2026-11-19" (util/shelf/tickedBooks.ts readersDay)
  body("today").optional().isString(),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const { changes, today } = matchedData(req) as {
      changes: Change[];
      today?: string;
    };
    const day = readersDay(today);
    const answers: ChangeAnswer[] = [];
    // one at a time, in the order they were made, and under the reader's
    // lock (util/shelf/oneAtATime.ts): owned volumes are read, merged and
    // written, so a tick saved from another device mid-way can't be lost
    await oneAtATime(userId, async () => {
      for (const change of changes)
        answers.push(await applyOne(userId, change, day));
    });
    res.json({ answers });
  },
];

async function applyOne(
  userId: number,
  change: Change,
  // the reader's day (readersDay)
  day: string,
): Promise<ChangeAnswer> {
  const manga = await prisma.manga.findFirst({
    where: { id: change.mangaId, userId },
  });
  if (!manga) return { saved: false, reason: "gone" };

  if (change.kind === "owned") {
    const now = [...ownedSet(manga)];
    const merged = mergeOwned(now, change.started ?? [], change.ended ?? []);
    await mangaQueries.setVolumesOwned(manga.id, ownedVolumes(null, merged));
    // (as a tick saved online does: util/shelf/tickedBooks.ts)
    await recordTickedBooks(manga, now, merged, day).catch((e) =>
      console.error(e),
    );
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
  if (change.kind === "state") {
    const now = { status: manga.status, planned: manga.planned };
    const to = mergeState(now, change.from, change.to);
    if (!sameState(to, now)) {
      await mangaQueries.setShelfState(manga, to);
      // finishing the series is finishing its last volume, as online
      if (to.status && !now.status)
        await askAboutFinishedVolume(userId, manga.id);
    }
    return { saved: true };
  }
  if (change.kind === "rating") {
    const now = manga.rating ?? 0;
    const to = mergeValue(now, change.from, change.to);
    if (to !== now) await mangaQueries.setRating(manga.id, to);
    return { saved: true };
  }
  if (change.kind === "notes") {
    // compared as sent: trimmed, empty as none (offlineRules.ts readChange)
    const now = manga.description?.trim() || null;
    const to = mergeNotes(now, change.from, change.to);
    if (to !== manga.description) await mangaQueries.setNotes(manga.id, to);
    return { saved: true };
  }
  const to = mergePlace(manga.readVolume, change.from, change.to);
  if (to != null && to > 999) return { saved: false, reason: "pastNewest" };
  await mangaQueries.setReading(manga, { readVolume: to });
  if ((to ?? 0) > (manga.readVolume ?? 0))
    await askAboutFinishedVolume(userId, manga.id);
  return { saved: true };
}
