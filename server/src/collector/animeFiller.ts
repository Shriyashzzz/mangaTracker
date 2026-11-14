// Anime answers for every series we know, without anyone having to open its
// page first.
//
// "After the anime" asks MangaUpdates where a series' anime leaves off the
// first time a person opens that series; a search engine's visit never asks
// (afterAnime/afterAnime.ts). So a series nobody has opened had an empty
// page that search engines are told to skip, and nobody arrives from a
// search to fill it. This job asks about each known series once, most
// popular first, one a minute. After that the answer is kept like any
// other: asked again when a page is opened and it's over a month old.
//
// MangaUpdates is free and needs no key. A light novel has no answer to
// look for (its volumes and chapters aren't the manga's).
//
// What it shares with the price jobs is in fillShared.ts.
import { prisma } from "../config/prisma.js";
import { animeLinesFor } from "../prices/afterAnime/animeSource.js";
import { isNovelName } from "../prices/lightNovel.js";
import { listKnownSeries } from "../prices/sources/anilist.js";
import { slugify } from "../prices/stores/match.js";
import type { SeriesInfo } from "../prices/types.js";
import { fillSwitchOn, startEvery, triedLately } from "./fillShared.js";

const EVERY_MS = 60_000;

// asked about lately, whatever came of it: when MangaUpdates can't be
// reached nothing is saved, and the series would be asked about every minute
const tried = triedLately();
export const resetAnimeFiller = () => tried.clear();

// a series' place in the queue: the most popular first, the unranked last
const rankOf = (series: SeriesInfo) => series.popularityRank ?? Infinity;

// the manga series MangaUpdates has never been asked about, most popular
// first. Database only
export async function animeQueue(): Promise<SeriesInfo[]> {
  const [everySeries, asked] = await Promise.all([
    listKnownSeries(),
    prisma.animeStops.findMany({ select: { slug: true } }),
  ]);
  const done = new Set(asked.map((row) => row.slug));
  return everySeries
    .filter((series) => !isNovelName(series.name))
    .filter((series) => !done.has(slugify(series.name)))
    .sort((one, other) => rankOf(one) - rankOf(other));
}

// one run: the next waiting series, if there is one. Says which it asked
// about, for the logs and the tests
export async function fillOneAnime(
  now = Date.now(),
): Promise<"off" | "nothing" | { asked: string }> {
  if (!fillSwitchOn()) return "off";
  const waiting = await animeQueue();
  const series = waiting.find((one) => tried.isDue(slugify(one.name), now));
  if (!series) return "nothing";
  tried.mark(slugify(series.name), now);
  // asks, and keeps the answer ("it has no anime" is one, and is kept too)
  await animeLinesFor(series, true);
  return { asked: series.name };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startAnimeFiller() {
  if (timer || !fillSwitchOn()) return;
  timer = startEvery("Anime answers", () => fillOneAnime(), {
    everyMs: EVERY_MS,
    firstAfterMs: 150_000,
  });
  console.log("Anime answers on: one series a minute until every one is asked");
}
