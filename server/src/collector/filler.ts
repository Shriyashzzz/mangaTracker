// Background pricing: volumes on readers' shelves that eBay's own API has
// never looked at get a look, one every few minutes, so shelf values and
// "to finish" totals become real prices instead of estimates. eBay's API is
// free; this only spends spare daily calls (PRICE_FILL_DAILY volumes, and
// only while eBay's day is under EBAY_SHARE used, leaving the rest to page
// visits). It runs the same check a volume page does (fetchProviders, the
// free sources only: eBay, and Books-A-Million and Better World Books when
// set up), marked as a
// background one so the home page's "recently checked" leaves it out. To buy
// lists come before shelves. Once every one of those volumes has had a look,
// it prices the most popular series' volumes nobody has opened
// (popularQueue), then keeps priced volumes fresh, the ones people are
// waiting on first (staleQueue).
//
// Canada gets its own share alongside (CANADA_FILL_DAILY volumes a day, 50):
// the same volumes in the same order (pricingQueue), looked at on eBay.ca,
// so Canadians see Canadian prices on their shelves and series pages too
// (fillCanadaOne).
// Only eBay's free API: the background never spends a paid search.
//
// What it shares with the other two jobs is in fillShared.ts.
import config from "../config/config.js";
import { checkCanada } from "../prices/canada/canadaPrices.js";
import { prisma } from "../config/prisma.js";
import priceQueries, {
  tablesOf,
  type Country,
} from "../models/priceQueries.js";
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
  olderThan,
  popularVolumes,
  shelfVolumes,
  startEvery,
  toBuyVolumes,
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

// the volumes a country's eBay has never looked at: To buy lists first, then
// shelves, owned ones before the ones still to get
export async function fillQueue(
  now = new Date(),
  country: Country = "us",
): Promise<string[]> {
  const [wanted, { owned, missing }] = await Promise.all([
    toBuyVolumes(now),
    shelfVolumes(now),
  ]);
  return neverLooked([...wanted, ...owned, ...missing], "ebay", country);
}

// how many of the most popular series' volumes a queue takes
const POPULAR_BATCH = 500;

// the ones of those eBay has never looked at
export async function popularQueue(
  now = new Date(),
  country: Country = "us",
): Promise<string[]> {
  const waiting = await neverLooked(await popularVolumes(now), "ebay", country);
  return waiting.slice(0, POPULAR_BATCH);
}

// Then keeping prices fresh. A day's share is a few hundred volumes, far
// fewer than the site has priced, so the ones people are waiting on go
// first:
//   1. To buy lists       over 3 days old
//   2. shelves            over 3 days old
//   3. opened by a person over 3 days old (their last check was a visitor's)
//   4. everything else    over 5 days old: still inside the week a price
//                         counts as fresh (models/priceAge.ts), and it
//                         leaves more of the share for the first three
// each oldest first. The last two are the pages search engines send people
// to, and a crawler's visit never sets off a check, so without this they'd
// only refresh when a person came
const STALE_MS = 3 * DAY_MS;
const REST_STALE_MS = 5 * DAY_MS;
const STALE_BATCH = 300;

// volumes whose eBay look is over this old, oldest first. `byAPerson`: only
// the ones whose last check a visitor set off, not a background job
async function anyOlderThan(
  ms: number,
  country: Country,
  now: Date,
  byAPerson = false,
) {
  const { checks, lastChecks } = tablesOf(country);
  const before = new Date(now.getTime() - ms);
  const rows = byAPerson
    ? await prisma.$queryRaw<{ isbn13: string }[]>`
        SELECT c.isbn13 FROM ${checks} c
        JOIN ${lastChecks} last USING (isbn13)
        WHERE c.source = 'ebay' AND c.checked_at < ${before}
          AND NOT ('fill' = ANY(last.sources))
        ORDER BY c.checked_at ASC
        LIMIT ${STALE_BATCH}
      `
    : await prisma.$queryRaw<{ isbn13: string }[]>`
        SELECT isbn13 FROM ${checks}
        WHERE source = 'ebay' AND checked_at < ${before}
        ORDER BY checked_at ASC
        LIMIT ${STALE_BATCH}
      `;
  return rows.map((r) => r.isbn13.trim());
}

export async function staleQueue(
  now = new Date(),
  country: Country = "us",
): Promise<string[]> {
  const [wanted, { owned, missing }] = await Promise.all([
    toBuyVolumes(now),
    shelfVolumes(now),
  ]);
  const at = now.getTime();
  const [toBuy, shelf, opened, rest] = await Promise.all([
    olderThan(wanted, STALE_MS, country, at),
    olderThan([...owned, ...missing], STALE_MS, country, at),
    anyOlderThan(STALE_MS, country, now, true),
    anyOlderThan(REST_STALE_MS, country, now),
  ]);
  return [...new Set([...toBuy, ...shelf, ...opened, ...rest])].slice(
    0,
    STALE_BATCH,
  );
}

// a country's whole queue, in order: never looked at (To buy, shelves, the
// popular series), then the stale ones
export async function pricingQueue(
  now = new Date(),
  country: Country = "us",
): Promise<string[]> {
  const [never, popular, stale] = await Promise.all([
    fillQueue(now, country),
    popularQueue(now, country).catch(() => []),
    staleQueue(now, country),
  ]);
  return [...new Set([...never, ...popular, ...stale])];
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
  if (now - queue.at > QUEUE_MS)
    queue = { at: now, isbns: await pricingQueue(new Date(now)) };
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

// ---------- Canada: eBay.ca, CANADA_FILL_DAILY volumes a day ----------

export const fillCanadaLabel = (day = ebayDay()) => `price-fill-ca:${day}`;

// the same volumes the US share looks at, in the same order, on eBay.ca
export const canadaQueue = (now = new Date()) => pricingQueue(now, "ca");

const triedInCanada = triedLately();
let canadaList: { at: number; isbns: string[] } = { at: 0, isbns: [] };

// one Canadian volume, if one is waiting and today's Canadian share and
// eBay's day both have room
export async function fillCanadaOne(
  now = Date.now(),
): Promise<"off" | "budget" | "done" | "nothing" | { isbn13: string }> {
  if (!fillerOn() || config.CANADA_PRICES === "off") return "off";
  if (!(await ebayHeadroom().catch(() => false))) return "budget";
  if (now - canadaList.at > QUEUE_MS)
    canadaList = { at: now, isbns: await canadaQueue(new Date(now)) };
  const isbn13 = canadaList.isbns.find((isbn) =>
    triedInCanada.isDue(isbn, now),
  );
  if (!isbn13) return "nothing";
  triedInCanada.mark(isbn13, now);
  const day = ebayDay();
  const claimed = await priceQueries.claimApiCall(
    fillCanadaLabel(day),
    config.CANADA_FILL_DAILY,
    monthOf(day),
  );
  if (!claimed) {
    triedInCanada.unmark(isbn13);
    return "done";
  }
  await checkCanada(isbn13, ["ebay"], { background: true });
  return { isbn13 };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startFiller() {
  if (timer || !fillerOn()) return;
  timer = startEvery(
    "Background pricing",
    async () => {
      await fillOne();
      await fillCanadaOne();
    },
    { everyMs: EVERY_MS, firstAfterMs: 60_000 },
  );
  console.log(
    `Background pricing on: up to ${config.PRICE_FILL_DAILY} US and ${config.CANADA_FILL_DAILY} Canadian volumes a day`,
  );
}
