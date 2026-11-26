// Edition lines for every series we know, without anyone having to open its
// page first.
//
// A series' omnibus and deluxe lines (prices/editionSource.ts) are looked up
// when its page is opened, and kept a week. Everything else that counts in an
// edition's books reads only what's saved: a shelf card's "VIZBIG 4", the New
// tab's "8 books behind", the Volumes tab's cost to finish. So a series
// nobody had opened counted in single volumes. This job asks about each known
// series whose lines are missing or old, most popular first, one every twenty
// minutes: about seventy a day, each up to six of Google Books' thousand
// daily lookups, one Open Library search, and one of the 2,000 CJ calls the
// price checks share (Books-A-Million's shelf: the books in print). All
// free. A page's own lookup never asks the store: only this job does.
//
// A light novel has no manga edition lines. What it shares with the other
// jobs is in fillShared.ts.
import { prisma } from "../config/prisma.js";
import { googleBackgroundLeft } from "../prices/callLog.js";
import priceQueries from "../models/priceQueries.js";
import {
  editionLinesFresh,
  halfAnswerKey,
  editionLinesOf,
  editionsKey,
} from "../prices/editionSource.js";
import { isNovelName } from "../prices/lightNovel.js";
import type { SeriesInfo } from "../prices/types.js";
import { volumesKey } from "../prices/volumesKey.js";
import {
  fillSwitchOn,
  knownSeries,
  startEvery,
  triedLately,
} from "./fillShared.js";

const EVERY_MS = 20 * 60_000;

// asked about lately, whatever came of it: a lookup that failed saves an
// answer that's retried in an hour, and the series would be asked about on
// every run until then
const tried = triedLately();
export const resetEditionFiller = () => tried.clear();

// a series' place in the queue: the most popular first, the unranked last
const rankOf = (series: SeriesInfo) => series.popularityRank ?? Infinity;

// the manga series whose edition lines are missing or old, most popular
// first. Database only
export async function editionQueue(now = Date.now()): Promise<SeriesInfo[]> {
  const manga = (await knownSeries()).filter(
    (series) => !isNovelName(series.name),
  );
  // each series' lines, and the marker of a half answer beside them
  const keys = manga.flatMap((series) => [
    editionsKey(series.name),
    halfAnswerKey(series.name),
  ]);
  const saved = await prisma.seriesVolumes.findMany({
    where: { key: { in: keys } },
    select: { key: true, fetchedAt: true },
  });
  const savedAt = new Map(
    saved.map((row) => [row.key, row.fetchedAt.getTime()]),
  );
  const isFresh = (series: SeriesInfo) => {
    const at = savedAt.get(editionsKey(series.name));
    const halfAt = savedAt.get(halfAnswerKey(series.name)) ?? null;
    return at != null && editionLinesFresh(at, now, halfAt);
  };
  return manga
    .filter((series) => !isFresh(series))
    .sort((one, other) => rankOf(one) - rankOf(other));
}

// one run: the next waiting series, if there is one. Says which it asked
// about, for the logs and the tests
export async function fillOneEdition(
  now = Date.now(),
): Promise<"off" | "nothing" | { asked: string }> {
  if (!fillSwitchOn()) return "off";
  // its lines are mostly Google's: with the background's share of the day
  // used, the next series waits for tomorrow (not marked as tried)
  if (!(await googleBackgroundLeft())) return "nothing";
  const waiting = await editionQueue(now);
  const series = waiting.find((one) => tried.isDue(editionsKey(one.name), now));
  if (!series) return "nothing";
  tried.mark(editionsKey(series.name), now);
  // the series' own volumes, as they're saved: its last volume, and the
  // books it already knows hold several. None saved is fine: the lines are
  // built without them, and again once its page has been opened
  const own = await priceQueries
    .getSeriesVolumes(volumesKey(series.name))
    .catch(() => null);
  // (and Books-A-Million's shelf with the catalogs: one CJ call)
  await editionLinesOf(series.name, own?.volumes ?? [], true, true);
  return { asked: series.name };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startEditionFiller() {
  if (timer || !fillSwitchOn()) return;
  timer = startEvery("Edition lines", () => fillOneEdition(), {
    everyMs: EVERY_MS,
    firstAfterMs: 210_000,
  });
  console.log("Edition lines on: one series every twenty minutes");
}
