// Background pricing: volumes on readers' shelves that eBay's own API has
// never looked at get a look, one every few minutes, so shelf values and
// "to finish" totals become real prices instead of estimates. eBay's API is
// free; this only spends spare daily calls (PRICE_FILL_DAILY volumes, and
// only while eBay's day is under EBAY_SHARE used, leaving the rest to page
// visits). It runs the same check a volume page does (fetchProviders, eBay
// only), marked as a background one so the home page's "recently checked"
// leaves it out.
//
// Production only unless PRICE_FILL=on: a laptop shares the eBay keys, and
// testing shouldn't spend the site's calls. PRICE_FILL=off stops it anywhere.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import ebay, { ebayApiEnabled } from "../prices/providers/ebay.js";
import {
  checkAlone,
  fetchProviders,
  getOrCreateBook,
} from "../prices/service.js";
import { isOut, ownedSet } from "./shelfMath.js";
import { shelfSeries } from "./shelfSeries.js";

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
    where: { isbn13: { in: all }, source: "ebay" },
    select: { isbn13: true },
  });
  const done = new Set(looked.map((r) => r.isbn13.trim()));
  return all.filter((isbn) => !done.has(isbn));
}

class ShareUsed extends Error {}

// one volume, if one is waiting and there are calls to spare. What happened,
// for the logs and the tests
export async function fillOne(
  now = Date.now(),
): Promise<"off" | "budget" | "done" | "nothing" | { isbn13: string }> {
  if (!fillerOn()) return "off";
  if (!(await ebayHeadroom().catch(() => false))) return "budget";
  if (now - queue.at > QUEUE_MS)
    queue = { at: now, isbns: await fillQueue(new Date(now)) };
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
          const looked = await tx.priceSourceCheck.findFirst({
            where: { isbn13, source: "ebay" },
          });
          if (looked) return;
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
            await fetchProviders(isbn13, book, [ebay], { background: true });
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
