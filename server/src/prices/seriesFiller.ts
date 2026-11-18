// Background volume lists: a series' volumes are only looked up when someone
// opens its page, so a series search engines reach first had none to show
// (226 of 386 on 2026-11-11), and one nobody reopened never learned of its
// new volumes or their dates. Every few minutes this takes one series, the
// same way a visit does (getSeries: Open Library, Google Books and AniList,
// all free), turn about:
//
//   building    the most popular series with no list yet. Once built it
//               counts as known: the series page, /series and the sitemap
//               list it
//   refreshing  a series whose list was last looked up over a week ago (one
//               on a shelf, or still running), or over a month ago (the
//               rest). Shelf series first, then the most popular: the
//               release calendar and "still to get" read these lists
//
// Each turn can take 2 Google Books calls, so it only runs while Google
// Books has calls to spare after visitors' share (collector/visitorPace.ts).
//
// Runs where the price filler runs (collector/filler.ts: production, or
// PRICE_FILL=on; PRICE_FILL=off stops both)
import { prisma } from "../config/prisma.js";
import { asBackground } from "./callLog.js";
import { priceName } from "./lightNovel.js";
import {
  forgetKnownVolumes,
  getSeries,
  knownVolumesBySeries,
  rebuildsDone,
} from "./service.js";
import { fillerOn } from "../collector/filler.js";
import { knownSeries } from "../collector/fillShared.js";
import { gbooksRoom } from "../collector/visitorPace.js";
import { slugify } from "./stores/match.js";
import { volumesKey } from "./volumesKey.js";

const DAY_MS = 24 * 60 * 60_000;
// every 6 minutes: each turn asks Google Books once or twice, and its ~1,000
// calls a day are shared with visitors and cover lookups
const EVERY_MS = 6 * 60_000;
// one that found nothing waits this long before it's tried again
const RETRY_MS = 7 * DAY_MS;

const tried = new Map<string, number>();

// the series with no volumes known, most popular first; ones tried lately
// wait their turn
async function nextSeries(now = Date.now()): Promise<string | null> {
  const [series, bySeries] = await Promise.all([
    knownSeries(),
    knownVolumesBySeries(),
  ]);
  const missing = series
    .filter((s) => !bySeries.get(slugify(s.name))?.size)
    .filter((s) => now - (tried.get(s.name) ?? -Infinity) >= RETRY_MS)
    .sort(
      (a, b) =>
        (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity) ||
        (b.score ?? 0) - (a.score ?? 0),
    );
  return missing[0]?.name ?? null;
}

// builds the next missing list: the most popular series with none. Also
// used by the nightly sweep, when Google Books has calls to spare
export async function fillSeries(now = Date.now()) {
  const name = await nextSeries(now);
  if (!name) return null;
  tried.set(name, now);
  const series = await getSeries(name);
  forgetKnownVolumes();
  return { name, volumes: series?.volumes.length ?? 0 };
}

// ---------- refreshing the lists there are ----------

// how old a list may get: a week for a series on a shelf or still running
// (new volumes and dates turn up), a month for the rest (a finished series
// still gets reprints and late English volumes)
const WATCHED_FRESH_MS = 7 * DAY_MS;
const OTHERS_FRESH_MS = 30 * DAY_MS;
// one refreshed (or tried) waits a day before it can be picked again: a
// catalog that's down leaves the list's date as it was
const REFRESH_RETRY_MS = DAY_MS;
const refreshed = new Map<string, number>();
// building and refreshing take turns (seriesTurn)
let turns = 0;
export const resetSeriesFiller = () => {
  tried.clear();
  refreshed.clear();
  turns = 0;
};

// a series with a list, as the refresh weighs it
export type Listed = {
  name: string;
  popularityRank: number | null;
  // AniList says it's finished
  finished: boolean;
  onShelf: boolean;
  // when its list was last looked up; null if never under its own name
  listAt: number | null;
};

// The next list to refresh: the ones past their age, shelf series first,
// then the most popular. null when every list is fresh enough
export function nextToRefresh(
  series: Listed[],
  now: number,
  isDue: (name: string) => boolean = () => true,
) {
  const freshFor = (s: Listed) =>
    s.onShelf || !s.finished ? WATCHED_FRESH_MS : OTHERS_FRESH_MS;
  const due = series
    .filter((s) => now - (s.listAt ?? -Infinity) >= freshFor(s))
    .filter((s) => isDue(s.name))
    .sort(
      (a, b) =>
        Number(b.onShelf) - Number(a.onShelf) ||
        (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity),
    );
  return due[0]?.name ?? null;
}

// every series that has a list, with what the refresh needs to know of it.
// Database only
async function listedSeries(): Promise<Listed[]> {
  const [series, bySeries, shelf] = await Promise.all([
    knownSeries(),
    knownVolumesBySeries(),
    prisma.manga.findMany({
      where: { userId: { not: null } },
      select: { name: true, lightNovel: true },
      distinct: ["name", "lightNovel"],
    }),
  ]);
  const listed = series.filter((s) => bySeries.get(slugify(s.name))?.size);
  const rows = await prisma.seriesVolumes.findMany({
    where: { key: { in: listed.map((s) => volumesKey(s.name)) } },
    select: { key: true, fetchedAt: true },
  });
  const lookedAt = new Map(rows.map((r) => [r.key, r.fetchedAt.getTime()]));
  // a shelf can hold a series under any name it goes by
  const onShelves = new Set(shelf.map((m) => slugify(priceName(m))));
  return listed.map((s) => ({
    name: s.name,
    popularityRank: s.popularityRank ?? null,
    finished: s.status === "FINISHED",
    onShelf: [s.name, ...(s.altNames ?? [])].some((name) =>
      onShelves.has(slugify(name)),
    ),
    listAt: lookedAt.get(volumesKey(s.name)) ?? null,
  }));
}

// refreshes the next list that's past its age. A visit to a series with an
// old list shows what's saved and looks it up again behind the page, so:
// open it (that starts the lookups), wait for them, and open it again,
// which saves the series' one list from what they found
export async function refreshSeries(now = Date.now()) {
  const name = nextToRefresh(
    await listedSeries(),
    now,
    (one) => now - (refreshed.get(one) ?? -Infinity) >= REFRESH_RETRY_MS,
  );
  if (!name) return null;
  refreshed.set(name, now);
  if (refreshed.size > 20_000) refreshed.delete(refreshed.keys().next().value!);
  await getSeries(name);
  await rebuildsDone();
  const series = await getSeries(name);
  forgetKnownVolumes();
  return { name, volumes: series?.volumes.length ?? 0 };
}

// ---------- the timer ----------

// one turn: building and refreshing take turns, and each steps in when the
// other has nothing to do. Nothing at all while Google Books has no calls
// to spare
export async function seriesTurn(now = Date.now()) {
  if (!(await gbooksRoom(now))) return "no room" as const;
  const refreshFirst = turns++ % 2 === 1;
  if (refreshFirst) return (await refreshSeries(now)) ?? fillSeries(now);
  return (await fillSeries(now)) ?? refreshSeries(now);
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startSeriesFiller() {
  if (timer || !fillerOn()) return;
  // its calls count as the background's (callLog.ts)
  const run = () =>
    asBackground(() => seriesTurn()).catch((e: Error) =>
      console.error("Background series lists failed:", e.message),
    );
  setTimeout(run, 90_000).unref();
  timer = setInterval(run, EVERY_MS);
  timer.unref();
  console.log(
    "Background series lists on: one built or refreshed every 6 minutes",
  );
}
