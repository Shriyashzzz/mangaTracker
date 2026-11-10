// Background pricing: volumes on readers' shelves that eBay's own API has
// never looked at get a look, one every few minutes, so shelf values and
// "to finish" totals become real prices instead of estimates. eBay's API is
// free; this only spends spare daily calls (PRICE_FILL_DAILY volumes, and
// never past the eBay daily budget). It runs the same check a volume page
// does (fetchProviders, eBay only), so what it saves is judged and stored
// exactly as if someone had opened the page.
//
// Production only unless PRICE_FILL=on: a laptop shares the eBay keys, and
// testing shouldn't spend the site's calls. PRICE_FILL=off stops it anywhere.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries from "../models/priceQueries.js";
import ebay, {
  ebayApiEnabled,
  ebayCallsLeft,
} from "../prices/providers/ebay.js";
import { fetchProviders, getOrCreateBook } from "../prices/service.js";
import { isOut, ownedSet } from "./shelfMath.js";
import { shelfSeries } from "./shelfSeries.js";

const EVERY_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
// the queue is rebuilt now and then, not on every run
const QUEUE_MS = 60 * 60_000;

// eBay's day, as the budget counts it (midnight Pacific)
const pacificDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
});
export const fillLabel = () => `price-fill:${pacificDay.format(new Date())}`;

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

// every volume out on any shelf that eBay's API has never looked at: owned
// ones first (they make up what shelves are worth), then the ones still to
// get. Database only
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
      if (!v.isbn13 || !isOut(v, now)) continue;
      (v.volume !== null && mine.has(v.volume) ? owned : missing).push(
        v.isbn13,
      );
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

// one volume, if one is waiting and there are calls to spare. What happened,
// for the logs and the tests
export async function fillOne(
  now = Date.now(),
): Promise<"off" | "budget" | "done" | "nothing" | { isbn13: string }> {
  if (!fillerOn()) return "off";
  if (!(await ebayCallsLeft().catch(() => false))) return "budget";
  if (now - queue.at > QUEUE_MS)
    queue = { at: now, isbns: await fillQueue(new Date(now)) };
  const isbn13 = queue.isbns.find((i) => now - (tried.get(i) ?? 0) > DAY_MS);
  if (!isbn13) return "nothing";
  // today's share of volumes, taken before looking
  if (!(await priceQueries.claimApiCall(fillLabel(), config.PRICE_FILL_DAILY)))
    return "done";
  tried.set(isbn13, now);
  if (tried.size > 50_000) tried.delete(tried.keys().next().value!);
  const book = await getOrCreateBook(isbn13);
  if (book) await fetchProviders(isbn13, book, [ebay]);
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
