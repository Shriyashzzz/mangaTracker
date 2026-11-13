// New prices for "Collect every volume" and "cost to finish", sooner:
// Books-A-Million's price for a volume the first time it matters, a few
// hundred a day.
//
// A series' total is exact only when every volume has a real new price;
// until then the rest are counted at the series' usual price and the total
// says "About". eBay's background job (filler.ts) asks Books-A-Million too,
// but at its own pace, 160 volumes a day. Books-A-Million allows 2,000
// lookups a day through CJ and uses a fraction, so this gives it a share of
// its own: BAM_FILL_DAILY volumes a day (400), one lookup each.
//
// What it asks about: volumes Books-A-Million has never been asked about.
// The ones readers still have to buy first (their "cost to finish"), then
// the ones they own, then the most popular series' (their pages' totals).
// A volume gets one first look here; keeping it fresh is the page's own job
// (every 3 days when someone opens it) and the eBay job's.
//
// Production only unless PRICE_FILL=on, like filler.ts.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import booksAMillion, {
  cjCallsLeft,
} from "../prices/providers/booksAMillion.js";
import {
  checkAlone,
  fetchProviders,
  getOrCreateBook,
} from "../prices/service.js";
import { popularVolumes, shelfVolumes } from "./filler.js";

// Books-A-Million's group in price_source_checks
const SOURCE = "books-a-million";
const EVERY_MS = 5 * 60_000;
// volumes a run: the day's share is used up over a few hours, not at once
const A_RUN = 10;

// the day in UTC, as CJ's own count goes (providers/booksAMillion.ts)
const today = () => new Date().toISOString().slice(0, 10);
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;
export const newFillLabel = (day = today()) => `bam-fill:${day}`;

export const newPriceFillerOn = () =>
  config.COLLECTOR_TOOLS !== "off" &&
  config.PRICE_FILL !== "off" &&
  (config.PRICE_FILL === "on" || config.ENV === "PROD") &&
  booksAMillion.enabled();

// the volumes Books-A-Million has never been asked about: still to buy,
// then owned, then the popular series'. Database only
export async function newPriceQueue(now = new Date()): Promise<string[]> {
  const [{ owned, missing }, popular] = await Promise.all([
    shelfVolumes(now),
    popularVolumes(now).catch(() => []),
  ]);
  const all = [...new Set([...missing, ...owned, ...popular])];
  if (!all.length) return [];
  const looked = await prisma.priceSourceCheck.findMany({
    where: { isbn13: { in: all }, source: SOURCE },
    select: { isbn13: true },
  });
  const done = new Set(looked.map((row) => row.isbn13.trim()));
  return all.filter((isbn) => !done.has(isbn));
}

// one run: up to A_RUN waiting volumes, while today's share and CJ's own
// allowance last. Says how many it asked about, for the logs and the tests
export async function fillNewPrices(
  now = new Date(),
): Promise<"off" | { asked: number }> {
  if (!newPriceFillerOn()) return "off";
  const waiting = (await newPriceQueue(now)).slice(0, A_RUN);
  let asked = 0;
  for (const isbn13 of waiting) {
    // CJ's day is used up (page visits come first): nothing to ask with
    if (!(await cjCallsLeft().catch(() => false))) break;
    // today's share of volumes, taken before looking
    const day = today();
    const claimed = await priceQueries.claimApiCall(
      newFillLabel(day),
      config.BAM_FILL_DAILY,
      monthOf(day),
    );
    if (!claimed) break;
    // the same check a page visit runs, Books-A-Million alone, and none
    // while a visit is pricing this volume
    await checkAlone(isbn13, async () => {
      const book = await getOrCreateBook(isbn13);
      if (!book) return;
      await fetchProviders(isbn13, book, [booksAMillion], { background: true });
    });
    asked++;
  }
  return { asked };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startNewPriceFiller() {
  if (timer || !newPriceFillerOn()) return;
  const run = () =>
    fillNewPrices().catch((e: Error) =>
      console.error("New price filling failed:", e.message),
    );
  setTimeout(run, 120_000).unref();
  timer = setInterval(run, EVERY_MS);
  timer.unref();
  console.log(
    `New prices on: Books-A-Million, up to ${config.BAM_FILL_DAILY} volumes a day`,
  );
}
