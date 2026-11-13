// Background pricing: volumes on readers' shelves that eBay's own API has
// never looked at get a look, one every few minutes, so shelf values and
// "to finish" totals become real prices instead of estimates. eBay's API is
// free; this only spends spare daily calls (PRICE_FILL_DAILY volumes, and
// only while eBay's day is under EBAY_SHARE used, leaving the rest to page
// visits). It runs the same check a volume page does (fetchProviders, the
// free sources only: eBay, and Books-A-Million and Better World Books when
// set up), marked as a
// background one so the home page's "recently checked" leaves it out. Once
// every shelf volume has had a look, it prices the most popular series'
// volumes nobody has opened (popularQueue), then keeps priced volumes fresh:
// the ones whose free sources looked over 3 days ago, oldest first
// (staleQueue).
//
// What it shares with the other two jobs is in fillShared.ts.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import { monthOf } from "../models/apiAllowance.js";
import betterWorldBooks from "../prices/providers/betterWorldBooks.js";
import booksAMillion from "../prices/providers/booksAMillion.js";
import ebay, { ebayApiEnabled, ebayDay } from "../prices/providers/ebay.js";
import {
  checkAlone,
  fetchProviders,
  getOrCreateBook,
} from "../prices/service.js";
import {
  DAY_MS,
  fillSwitchOn,
  neverLooked,
  popularVolumes,
  shelfVolumes,
  startEvery,
  triedLately,
} from "./fillShared.js";

const EVERY_MS = 5 * 60_000;
// the queue is rebuilt now and then, not on every run
const QUEUE_MS = 60 * 60_000;
// page visits come first: the background stops once eBay's day is this far
// gone, leaving the rest of the allowance to people opening volumes
const EBAY_SHARE = 0.6;

// the day's share is counted by eBay's own day (midnight Pacific: ebayDay)
export const fillLabel = (day = ebayDay()) => `price-fill:${day}`;

const ebayHeadroom = () => {
  const day = ebayDay();
  return priceQueries.anyCallsLeft(
    [`ebay:${day}`],
    Math.floor(config.EBAY_DAILY_LIMIT * EBAY_SHARE),
    monthOf(day),
  );
};

export const fillerOn = () => fillSwitchOn() && ebayApiEnabled();

// tried lately, whatever came of it: a volume that fails doesn't hold up the
// queue, and gets another go a day later
const tried = triedLately();
let queue: { at: number; isbns: string[] } = { at: 0, isbns: [] };

export const resetFiller = () => {
  tried.clear();
  queue = { at: 0, isbns: [] };
};

// the shelf volumes eBay's API has never looked at: owned ones first, then
// the ones still to get
export async function fillQueue(now = new Date()): Promise<string[]> {
  const { owned, missing } = await shelfVolumes(now);
  return neverLooked([...owned, ...missing], "ebay");
}

// how many of the most popular series' volumes a queue takes
const POPULAR_BATCH = 500;

// the ones of those eBay has never looked at
export async function popularQueue(now = new Date()): Promise<string[]> {
  const waiting = await neverLooked(await popularVolumes(now), "ebay");
  return waiting.slice(0, POPULAR_BATCH);
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

// the free sources a background check asks: eBay's API, and when their keys
// are set Books-A-Million (it keeps to its own daily count) and Better World
// Books. So a used price found once (usedFiller.ts) is looked at again
// whenever eBay's is, and a copy that sold months ago doesn't stay up
const freeProviders = () =>
  [ebay, booksAMillion, betterWorldBooks].filter((provider) =>
    provider.enabled(),
  );

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
  const isbn13 = queue.isbns.find((isbn) => tried.isDue(isbn, now));
  if (!isbn13) return "nothing";
  tried.mark(isbn13, now);
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
          const looked = await tx.priceSourceCheck.findFirst({
            where: { isbn13, source: "ebay" },
          });
          // looked at since the queue was built (or lately enough): skipped
          if (looked && now - looked.checkedAt.getTime() < STALE_MS) return;
          // today's share of volumes, taken before looking
          const day = ebayDay();
          const claimed = await priceQueries.claimApiCall(
            fillLabel(day),
            config.PRICE_FILL_DAILY,
            monthOf(day),
          );
          if (!claimed) throw new ShareUsed();
          const book = await getOrCreateBook(isbn13);
          if (book)
            await fetchProviders(isbn13, book, freeProviders(), {
              background: true,
            });
        },
        // the lock lasts the check: eBay's three searches, a few seconds
        { timeout: 60_000, maxWait: 10_000 },
      ),
    );
  } catch (e) {
    if (e instanceof ShareUsed) {
      // it wasn't looked at: it keeps its place for tomorrow's share
      tried.unmark(isbn13);
      return "done";
    }
    throw e;
  }
  return { isbn13 };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startFiller() {
  if (timer || !fillerOn()) return;
  timer = startEvery("Background pricing", () => fillOne(), {
    everyMs: EVERY_MS,
    firstAfterMs: 60_000,
  });
  console.log(
    `Background pricing on: up to ${config.PRICE_FILL_DAILY} volumes a day`,
  );
}
