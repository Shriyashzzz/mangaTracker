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
// it's never asked again from here. Looking again is the eBay job's work
// (filler.ts asks Better World Books whenever it refreshes a volume) and the
// volume's own page's (prices/volumeService.ts, every 3 days at most).
//
// What it shares with the other two jobs is in fillShared.ts.
import priceQueries from "../models/priceQueries.js";
import betterWorldBooks, {
  bwbOffers,
} from "../prices/providers/betterWorldBooks.js";
import { checkAlone, getOrCreateBook } from "../prices/service.js";
import type { Offer } from "../prices/types.js";
import {
  fillSwitchOn,
  neverLooked,
  shelfVolumes,
  startEvery,
} from "./fillShared.js";

// Better World Books' group in price_source_checks
const SOURCE = "better-world-books";
const EVERY_MS = 5 * 60_000;
// volumes a run (bwbOffers asks 50 to a request). A 2,000-volume shelf is
// done in under an hour, at about 50 requests an hour of the 3,000 allowed
const A_RUN = 200;
const REQUEST_TIMEOUT_MS = 30_000;

export const usedFillerOn = () => fillSwitchOn() && betterWorldBooks.enabled();

// the shelf volumes Better World Books has never been asked about: owned
// ones first, then the ones still to get. Database only
export async function usedQueue(now = new Date()): Promise<string[]> {
  const { owned, missing } = await shelfVolumes(now);
  return neverLooked([...owned, ...missing], SOURCE);
}

// saves one volume's answer the way a background check does ("fill": the
// home page's "recently checked" leaves it out). An empty answer is saved
// too: that's what stops it being asked again. Saved directly, not through
// fetchProviders: that asks one volume at a time, and this has the answers
// for 200 already. A used copy needs none of its checks on new prices
async function saveLook(isbn13: string, offers: Map<string, Offer>) {
  // a volume a page visit is pricing right now is left to that visit
  await checkAlone(isbn13, async () => {
    // prices hang off the book's own row; a shelf volume's is made from its
    // series' saved list
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

// one run: up to A_RUN waiting volumes. Says how many it asked about and
// how many Better World Books had, for the logs and the tests. A run that
// fails saves nothing, so the same volumes wait for the next one: an outage
// costs a request every five minutes, never a wrong "they don't have it"
export async function fillUsedOnce(
  now = new Date(),
): Promise<"off" | { asked: number; found: number }> {
  if (!usedFillerOn()) return "off";
  const waiting = (await usedQueue(now)).slice(0, A_RUN);
  if (!waiting.length) return { asked: 0, found: 0 };
  const offers = await bwbOffers(
    waiting,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  );
  for (const isbn13 of waiting) await saveLook(isbn13, offers);
  return { asked: waiting.length, found: offers.size };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startUsedFiller() {
  if (timer || !usedFillerOn()) return;
  const run = async () => {
    const result = await fillUsedOnce();
    if (result !== "off" && result.asked)
      console.log(
        `Used prices: asked Better World Books about ${result.asked} shelf volumes, it had ${result.found}`,
      );
  };
  timer = startEvery("Used price filling", run, {
    everyMs: EVERY_MS,
    firstAfterMs: 90_000,
  });
  console.log("Used prices on: Better World Books, once per shelf volume");
}
