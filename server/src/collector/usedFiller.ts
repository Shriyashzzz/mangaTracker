// What a shelf is worth used, quickly: Better World Books' used price for
// every volume on readers' shelves, asked ONCE per volume and kept.
//
// Most of what's on a shelf is a used book the day after it's bought, so a
// used price is the honest one for "How much is my shelf worth?". eBay's
// background looks (filler.ts) are slow on purpose: 160 volumes a day, to
// save its daily allowance. Impact's feed has no such limit (3,000 requests
// an hour, 50 volumes a request), so a reader who imports 2,000 volumes
// gets their used prices within the hour, not in two weeks.
//
// The rule: a volume gets one look, the first time it's on any shelf, owned
// ones first. Whatever came back is saved, "they don't have it" included, so
// it's never asked again from here. Only someone opening the volume's own
// page looks again (prices/volumeService.ts, every 3 days at most).
//
// Production only unless PRICE_FILL=on, like filler.ts.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import betterWorldBooks, {
  bwbOffers,
} from "../prices/providers/betterWorldBooks.js";
import { checkAlone, getOrCreateBook } from "../prices/service.js";
import type { Offer } from "../prices/types.js";
import { shelfVolumes } from "./filler.js";

// Better World Books' group in price_source_checks
const SOURCE = "better-world-books";
const EVERY_MS = 5 * 60_000;
// volumes a run: four requests of 50. A 2,000-volume shelf is done in under
// an hour, at about 50 requests an hour of the 3,000 allowed
const A_RUN = 200;
const A_REQUEST = 50;
const REQUEST_TIMEOUT_MS = 30_000;

export const usedFillerOn = () =>
  config.COLLECTOR_TOOLS !== "off" &&
  config.PRICE_FILL !== "off" &&
  (config.PRICE_FILL === "on" || config.ENV === "PROD") &&
  betterWorldBooks.enabled();

// the shelf volumes Better World Books has never been asked about: owned
// ones first, then the ones still to get. Database only
export async function usedQueue(now = new Date()): Promise<string[]> {
  const { owned, missing } = await shelfVolumes(now);
  const all = [...new Set([...owned, ...missing])];
  if (!all.length) return [];
  const looked = await prisma.priceSourceCheck.findMany({
    where: { isbn13: { in: all }, source: SOURCE },
    select: { isbn13: true },
  });
  const done = new Set(looked.map((row) => row.isbn13.trim()));
  return all.filter((isbn) => !done.has(isbn));
}

// saves one volume's answer the way a background check does ("fill": the
// home page's "recently checked" leaves it out). An empty answer is saved
// too: that's what stops it being asked again
async function saveLook(isbn13: string, offers: Map<string, Offer>) {
  // a volume a page visit is pricing right now is left to that visit
  await checkAlone(isbn13, async () => {
    // prices hang off the book's own row; a shelf volume's is made from its
    // series' saved list, without asking any catalog
    const book = await getOrCreateBook(isbn13);
    if (!book) return;
    const theirs = offers.get(isbn13);
    await priceQueries.saveCheck(
      isbn13,
      [SOURCE, "fill"],
      new Map([[SOURCE, theirs ? [theirs] : []]]),
    );
  });
}

// one run: up to A_RUN waiting volumes, A_REQUEST to a request. Says how
// many it asked about and how many Better World Books had, for the logs and
// the tests
export async function fillUsedOnce(
  now = new Date(),
): Promise<"off" | { asked: number; found: number }> {
  if (!usedFillerOn()) return "off";
  const waiting = (await usedQueue(now)).slice(0, A_RUN);
  let found = 0;
  for (let at = 0; at < waiting.length; at += A_REQUEST) {
    const batch = waiting.slice(at, at + A_REQUEST);
    const offers = await bwbOffers(
      batch,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    );
    found += offers.size;
    for (const isbn13 of batch) await saveLook(isbn13, offers);
  }
  return { asked: waiting.length, found };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startUsedFiller() {
  if (timer || !usedFillerOn()) return;
  const run = () =>
    fillUsedOnce()
      .then((result) => {
        if (result !== "off" && result.asked)
          console.log(
            `Used prices: asked Better World Books about ${result.asked} shelf volumes, it had ${result.found}`,
          );
      })
      .catch((e: Error) =>
        console.error("Used price filling failed:", e.message),
      );
  setTimeout(run, 90_000).unref();
  timer = setInterval(run, EVERY_MS);
  timer.unref();
  console.log("Used prices on: Better World Books, once per shelf volume");
}
