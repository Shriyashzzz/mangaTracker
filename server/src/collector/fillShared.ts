// What the background price jobs share, so each rule is written once:
//
//   filler.ts          eBay (and the other free stores alongside), slowly
//   usedFiller.ts      Better World Books' used price, once per shelf volume
//   newPriceFiller.ts  Books-A-Million's new price, a few hundred a day
//
// and animeFiller.ts (anime answers from MangaUpdates) uses the switch, the
// memory and the timer.
//
// Here: the switch that turns them on, which volumes they look at, which of
// those a store has never been asked about, the memory of what was tried
// lately, and the timer that runs a job.
//
// Whose volumes come first, in every job: the ones on a To buy list (someone
// is about to buy them), then shelves, then the popular series, then the
// rest.
import { asBackground, inBackground } from "../prices/callLog.js";
import config from "../config/config.js";
import { tablesOf, type Country } from "../models/priceTables.js";
import { prisma } from "../config/prisma.js";
import {
  isRebind,
  knownVolumesBySeries,
  titleVolume,
} from "../prices/service.js";
import { listKnownSeries } from "../prices/sources/anilist.js";
import { slugify } from "../prices/stores/match.js";
import { isOut, ownedSet, releaseDay } from "./shelfMath.js";
import { shelfSeries } from "./shelfSeries.js";

export const DAY_MS = 24 * 60 * 60_000;

// Background jobs run in production only, unless PRICE_FILL=on: a laptop
// shares the site's keys, and testing shouldn't spend its calls.
// PRICE_FILL=off stops them anywhere. Each job adds "and my store's keys
// are set"
export const fillSwitchOn = () =>
  config.COLLECTOR_TOOLS !== "off" &&
  config.PRICE_FILL !== "off" &&
  (config.PRICE_FILL === "on" || config.ENV === "PROD");

// The timers' runs share one copy of the big lists they all read (every
// shelf, every known series) for ten minutes: five jobs asking every few
// minutes would otherwise each read every reader's shelf again, which is
// the first thing to slow down as the site grows. Only inside a timer's run
// (asBackground): anything else, a test or a script, reads afresh
const SHARED_MS = 10 * 60_000;
function sharedByJobs<T>(read: () => Promise<T>) {
  let kept: { at: number; value: Promise<T> } | null = null;
  return () => {
    if (!inBackground()) return read();
    if (!kept || Date.now() - kept.at > SHARED_MS) {
      const value = read();
      kept = { at: Date.now(), value };
      // a read that failed isn't kept: the next run reads again
      value.catch(() => {
        if (kept?.value === value) kept = null;
      });
    }
    return kept.value;
  };
}

// every series the site knows, as the jobs read it
export const knownSeries = sharedByJobs(listKnownSeries);

// every numbered volume out on any shelf, by ISBN: the ones readers own
// (they make up what shelves are worth), and the ones still to get. Only
// whole-numbered volumes, the ones shelf totals count: never a guidebook or
// anything else a list holds. Database only
const sharedShelf = sharedByJobs(() => readShelfVolumes(new Date()));
export const shelfVolumes = (now = new Date()) =>
  inBackground() ? sharedShelf() : readShelfVolumes(now);

async function readShelfVolumes(now: Date) {
  // only what's read of a shelf entry: its name and what's owned of it
  const manga = await prisma.manga.findMany({
    where: { userId: { not: null } },
    select: {
      name: true,
      lightNovel: true,
      volumesOwned: true,
      ownedList: true,
    },
  });
  const owned: string[] = [];
  const missing: string[] = [];
  for (const series of await shelfSeries(manga)) {
    const mine = ownedSet(series.manga);
    for (const volume of series.volumes) {
      const counts =
        volume.isbn13 &&
        volume.volume !== null &&
        volume.volume >= 1 &&
        Number.isInteger(volume.volume) &&
        isOut(volume, now);
      if (!counts) continue;
      const list = mine.has(volume.volume!) ? owned : missing;
      list.push(volume.isbn13!);
    }
  }
  return { owned, missing };
}

// The volumes on readers' To buy lists that are out now, the latest added
// first: someone means to buy each one, so every job looks at these before
// anything else. A preorder waits until it's out (it has no price to find).
// Database only
const sharedToBuy = sharedByJobs(() => readToBuyVolumes(new Date()));
export const toBuyVolumes = (now = new Date()) =>
  inBackground() ? sharedToBuy() : readToBuyVolumes(now);

async function readToBuyVolumes(now: Date) {
  const [rows, bySeries] = await Promise.all([
    prisma.toBuy.findMany({
      orderBy: { addedAt: "desc" },
      select: { isbn13: true },
    }),
    knownVolumesBySeries(),
  ]);
  // each listed volume's release date, where a series' list knows it
  const publishedOf = new Map<string, string>();
  for (const volumes of bySeries.values())
    for (const volume of volumes.values())
      if (volume.published)
        publishedOf.set(volume.isbn13.trim(), volume.published);
  const isbns = rows.map((row) => row.isbn13.trim());
  return [...new Set(isbns)].filter((isbn) => {
    const day = releaseDay(publishedOf.get(isbn));
    return !day || day <= now;
  });
}

// The most popular series' volumes, a series' in order: a collector weighing
// up One Piece sees "Check price" on most of it otherwise, and its "collect
// every volume" total is mostly a guess. Whole volumes out now, never a
// library rebind
const POPULAR_SERIES = 150;

export async function popularVolumes(now = new Date()): Promise<string[]> {
  const [everySeries, bySeries] = await Promise.all([
    knownSeries(),
    knownVolumesBySeries(),
  ]);
  const mostPopular = everySeries
    .filter((series) => series.popularityRank != null)
    .sort((one, other) => one.popularityRank! - other.popularityRank!)
    .slice(0, POPULAR_SERIES);
  const today = now.toISOString().slice(0, 10);
  const isbns: string[] = [];
  for (const series of mostPopular) {
    const known = [...(bySeries.get(slugify(series.name))?.values() ?? [])];
    const volumes = known
      .map((volume) => ({ ...volume, number: titleVolume(volume.title) }))
      .filter(
        (volume) =>
          volume.number != null &&
          volume.number >= 1 &&
          Number.isInteger(volume.number) &&
          !isRebind(volume.isbn13) &&
          (!volume.published || volume.published.slice(0, 10) <= today),
      )
      .sort((one, other) => one.number! - other.number!);
    isbns.push(...volumes.map((volume) => volume.isbn13.trim()));
  }
  return [...new Set(isbns)];
}

// of these volumes, the ones a store has never been asked about, in the
// order given. `source` is the store's group in price_source_checks (or,
// for Canada, ca_price_source_checks)
export async function neverLooked(
  isbns: string[],
  source: string,
  country: Country = "us",
) {
  const all = [...new Set(isbns)];
  if (!all.length) return [];
  const looked = await prisma.$queryRaw<{ isbn13: string }[]>`
    SELECT isbn13 FROM ${tablesOf(country).checks}
    WHERE isbn13 = ANY(${all}::text[]) AND source = ${source}
  `;
  const done = new Set(looked.map((row) => row.isbn13.trim()));
  return all.filter((isbn) => !done.has(isbn));
}

// of these volumes, the ones a country's eBay last looked at over this long
// ago, oldest first
export async function olderThan(
  isbns: string[],
  ms: number,
  country: Country,
  now = Date.now(),
) {
  if (!isbns.length) return [];
  const rows = await prisma.$queryRaw<{ isbn13: string }[]>`
    SELECT isbn13 FROM ${tablesOf(country).checks}
    WHERE source = 'ebay' AND isbn13 = ANY(${isbns}::text[])
      AND checked_at < ${new Date(now - ms)}
    ORDER BY checked_at ASC
  `;
  return rows.map((r) => r.isbn13.trim());
}

// What a job tried lately, whatever came of it. A look that fails saves
// nothing, so the volume would stay at the head of the queue and be asked
// again on every run, spending the day's calls on the same few volumes.
// Remembered here, it steps aside for a day and the queue moves on.
// In memory: a restart forgets it, which costs one more try each
export function triedLately(waitMs = DAY_MS) {
  const tried = new Map<string, number>();
  return {
    // not tried within the wait
    isDue: (isbn13: string, now: number) =>
      now - (tried.get(isbn13) ?? 0) > waitMs,
    mark(isbn13: string, now: number) {
      tried.set(isbn13, now);
      if (tried.size > 50_000) tried.delete(tried.keys().next().value!);
    },
    // it wasn't tried after all (the day's share had run out)
    unmark: (isbn13: string) => tried.delete(isbn13),
    clear: () => tried.clear(),
  };
}

// runs a job a little after the server starts, then on a timer. A run that
// throws is logged and the next one still happens. Never keeps the server
// alive on its own
export function startEvery(
  name: string,
  run: () => Promise<unknown>,
  { everyMs, firstAfterMs }: { everyMs: number; firstAfterMs: number },
) {
  // its calls count as the background's, apart from visitors' (callLog.ts)
  const safely = () =>
    asBackground(run).catch((e: Error) =>
      console.error(`${name} failed:`, e.message),
    );
  setTimeout(safely, firstAfterMs).unref();
  const timer = setInterval(safely, everyMs);
  timer.unref();
  return timer;
}
