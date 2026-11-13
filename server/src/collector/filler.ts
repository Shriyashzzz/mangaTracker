// Background pricing: volumes on readers' shelves that eBay's own API has
// never looked at get a look, one every few minutes, so shelf values and
// "to finish" totals become real prices instead of estimates. eBay's API is
// free; this only spends spare daily calls (PRICE_FILL_DAILY volumes, and
// only while eBay's day is under EBAY_SHARE used, leaving the rest to page
// visits). It runs the same check a volume page does (fetchProviders, the
// free sources only: eBay, Books-A-Million when set up, and Better World
// Books once per volume), marked as a
// background one so the home page's "recently checked" leaves it out. Once
// every shelf volume has had a look, it prices the most popular series'
// volumes nobody has opened (popularQueue), then keeps priced volumes fresh:
// the ones whose free sources looked over 3 days ago, oldest first
// (staleQueue).
//
// Production only unless PRICE_FILL=on: a laptop shares the eBay keys, and
// testing shouldn't spend the site's calls. PRICE_FILL=off stops it anywhere.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import ebay, { ebayApiEnabled } from "../prices/providers/ebay.js";
import booksAMillion from "../prices/providers/booksAMillion.js";
import betterWorldBooks from "../prices/providers/betterWorldBooks.js";
import {
  checkAlone,
  fetchProviders,
  getOrCreateBook,
  isRebind,
  knownVolumesBySeries,
  titleVolume,
} from "../prices/service.js";
import { listKnownSeries } from "../prices/sources/anilist.js";
import { slugify } from "../prices/stores/match.js";
import { isOut, ownedSet } from "./shelfMath.js";
import { shelfSeries } from "./shelfSeries.js";

// Better World Books' group in price_source_checks
const BWB = "better-world-books";

const EVERY_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
// the queue is rebuilt now and then, not on every run
const QUEUE_MS = 60 * 60_000;
// page visits come first: the background stops once eBay's day is this far
// gone, leaving the rest of the allowance to people opening volumes
const EBAY_SHARE = 0.6;

// eBay's day, as the budget counts it (midnight Pacific). A row's month is
// that day's, not the database clock's: in UTC the month turns over hours
// earlier, which would restart the count mid-day
const pacificDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
});
const today = () => pacificDay.format(new Date());
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;
export const fillLabel = (day = today()) => `price-fill:${day}`;

const ebayHeadroom = () => {
  const day = today();
  return priceQueries.anyCallsLeft(
    [`ebay:${day}`],
    Math.floor(config.EBAY_DAILY_LIMIT * EBAY_SHARE),
    monthOf(day),
  );
};

export const fillerOn = () =>
  config.COLLECTOR_TOOLS !== "off" &&
  config.PRICE_FILL !== "off" &&
  (config.PRICE_FILL === "on" || config.ENV === "PROD") &&
  ebayApiEnabled();

// tried lately, whatever came of it: a volume that fails doesn't hold up the
// queue, and gets another go a day later
const tried = new Map<string, number>();
let queue: { at: number; isbns: string[] } = { at: 0, isbns: [] };

export const resetFiller = () => {
  tried.clear();
  queue = { at: 0, isbns: [] };
};

// every numbered volume out on any shelf that eBay's API has never looked
// at: owned ones first (they make up what shelves are worth), then the ones
// still to get. Only whole-numbered volumes, the ones shelf totals count:
// never a guidebook or anything else a list holds. Database only
export async function fillQueue(now = new Date()): Promise<string[]> {
  const manga = await prisma.manga.findMany({
    where: { userId: { not: null } },
  });
  const series = await shelfSeries(manga);
  const owned: string[] = [];
  const missing: string[] = [];
  for (const s of series) {
    const mine = ownedSet(s.manga);
    for (const v of s.volumes) {
      if (
        !v.isbn13 ||
        v.volume === null ||
        v.volume < 1 ||
        !Number.isInteger(v.volume) ||
        !isOut(v, now)
      )
        continue;
      (mine.has(v.volume) ? owned : missing).push(v.isbn13);
    }
  }
  const all = [...new Set([...owned, ...missing])];
  if (!all.length) return [];
  const looked = await prisma.priceSourceCheck.findMany({
    where: { isbn13: { in: all }, source: { in: ["ebay", BWB] } },
    select: { isbn13: true, source: true },
  });
  const by = (source: string) =>
    new Set(
      looked.filter((r) => r.source === source).map((r) => r.isbn13.trim()),
    );
  const ebayLooked = by("ebay");
  const bwbLooked = by(BWB);
  // Better World Books looks at each shelf volume once (see fillOne): one it
  // hasn't seen is still waiting, even when eBay has
  const wantsBwb = betterWorldBooks.enabled();
  return all.filter(
    (isbn) => !ebayLooked.has(isbn) || (wantsBwb && !bwbLooked.has(isbn)),
  );
}

// Then the most popular series' volumes nobody has priced yet: a collector
// weighing up One Piece sees "Check price" on most of it otherwise, and its
// "collect every volume" total is mostly a guess. Most popular first, a
// series' volumes in order; whole volumes out now, never a library rebind
const POPULAR_SERIES = 150;
const POPULAR_BATCH = 500;

export async function popularQueue(now = new Date()): Promise<string[]> {
  const [series, bySeries] = await Promise.all([
    listKnownSeries(),
    knownVolumesBySeries(),
  ]);
  const today = now.toISOString().slice(0, 10);
  const isbns: string[] = [];
  const top = series
    .filter((s) => s.popularityRank != null)
    .sort((a, b) => a.popularityRank! - b.popularityRank!)
    .slice(0, POPULAR_SERIES);
  for (const s of top) {
    const volumes = [...(bySeries.get(slugify(s.name))?.values() ?? [])]
      .map((v) => ({ ...v, n: titleVolume(v.title) }))
      .filter(
        (v) =>
          v.n != null &&
          v.n >= 1 &&
          Number.isInteger(v.n) &&
          !isRebind(v.isbn13) &&
          (!v.published || v.published.slice(0, 10) <= today),
      )
      .sort((a, b) => a.n! - b.n!);
    isbns.push(...volumes.map((v) => v.isbn13.trim()));
  }
  const all = [...new Set(isbns)];
  if (!all.length) return [];
  const looked = await prisma.priceSourceCheck.findMany({
    where: { isbn13: { in: all }, source: "ebay" },
    select: { isbn13: true },
  });
  const done = new Set(looked.map((r) => r.isbn13.trim()));
  return all.filter((i) => !done.has(i)).slice(0, POPULAR_BATCH);
}

// Then keeping prices fresh: a volume already priced whose free sources
// (eBay, Books-A-Million) last looked over this long ago, oldest first. These
// are the pages search engines send people to, and a crawler's visit never
// sets off a check, so without this they'd only refresh when a person came
const STALE_MS = 3 * DAY_MS;
const STALE_BATCH = 300;

export async function staleQueue(now = new Date()): Promise<string[]> {
  const rows = await prisma.priceSourceCheck.findMany({
    where: {
      source: "ebay",
      checkedAt: { lt: new Date(now.getTime() - STALE_MS) },
    },
    orderBy: { checkedAt: "asc" },
    take: STALE_BATCH,
    select: { isbn13: true },
  });
  return rows.map((r) => r.isbn13.trim());
}

// the free sources a background check asks. eBay's API and Books-A-Million
// (when its keys are set; it keeps to its own daily count) whenever eBay's
// look is old. Better World Books once only per volume: a used price for
// what a shelf is worth, kept from then on. It's looked at again only when
// someone opens the volume's page
function providersFor(looks: { ebayIsFresh: boolean; bwbHasLooked: boolean }) {
  const asked = [];
  if (!looks.ebayIsFresh) asked.push(ebay, booksAMillion);
  if (!looks.bwbHasLooked) asked.push(betterWorldBooks);
  return asked.filter((p) => p.enabled());
}

class ShareUsed extends Error {}

// one volume, if one is waiting and there are calls to spare. What happened,
// for the logs and the tests
export async function fillOne(
  now = Date.now(),
): Promise<"off" | "budget" | "done" | "nothing" | { isbn13: string }> {
  if (!fillerOn()) return "off";
  if (!(await ebayHeadroom().catch(() => false))) return "budget";
  if (now - queue.at > QUEUE_MS) {
    const [never, popular, stale] = await Promise.all([
      fillQueue(new Date(now)),
      popularQueue(new Date(now)).catch(() => []),
      staleQueue(new Date(now)),
    ]);
    queue = { at: now, isbns: [...new Set([...never, ...popular, ...stale])] };
  }
  const isbn13 = queue.isbns.find((i) => now - (tried.get(i) ?? 0) > DAY_MS);
  if (!isbn13) return "nothing";
  tried.set(isbn13, now);
  if (tried.size > 50_000) tried.delete(tried.keys().next().value!);
  // One check of a volume at a time: none while a page visit's is running in
  // this server, and none while another server is pricing it (a database
  // lock held for the check). Looked at since the queue was built: skipped
  try {
    await checkAlone(isbn13, () =>
      prisma.$transaction(
        async (tx) => {
          const [lock] = await tx.$queryRaw<{ got: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(hashtext(${`price-fill:${isbn13}`})) AS got`;
          if (!lock?.got) return;
          const [looked, bwbLooked] = await Promise.all([
            tx.priceSourceCheck.findFirst({
              where: { isbn13, source: "ebay" },
            }),
            tx.priceSourceCheck.findFirst({ where: { isbn13, source: BWB } }),
          ]);
          const asked = providersFor({
            ebayIsFresh: Boolean(
              looked && now - looked.checkedAt.getTime() < STALE_MS,
            ),
            bwbHasLooked: Boolean(bwbLooked),
          });
          // looked at since the queue was built (or lately enough): skipped
          if (!asked.length) return;
          // today's share of volumes, taken before looking
          const day = today();
          const claimed = await priceQueries.claimApiCall(
            fillLabel(day),
            config.PRICE_FILL_DAILY,
            monthOf(day),
          );
          if (!claimed) throw new ShareUsed();
          const book = await getOrCreateBook(isbn13);
          if (book)
            await fetchProviders(isbn13, book, asked, { background: true });
        },
        // the lock lasts the check: eBay's three searches, a few seconds
        { timeout: 60_000, maxWait: 10_000 },
      ),
    );
  } catch (e) {
    if (e instanceof ShareUsed) return "done";
    throw e;
  }
  return { isbn13 };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startFiller() {
  if (timer || !fillerOn()) return;
  const run = () =>
    fillOne().catch((e: Error) =>
      console.error("Background pricing failed:", e.message),
    );
  setTimeout(run, 60_000).unref();
  timer = setInterval(run, EVERY_MS);
  timer.unref();
  console.log(
    `Background pricing on: up to ${config.PRICE_FILL_DAILY} volumes a day`,
  );
}
