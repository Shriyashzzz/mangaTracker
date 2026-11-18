// The nightly sweep: each day's free API calls that visitors didn't use are
// spent pricing manga nobody has opened yet, one series at a time, so their
// series pages show real prices and box sets, and "Collect every volume"
// becomes a real total instead of "About".
//
// When:  eBay, Books-A-Million and Google Books from 8pm Pacific until their
//        midnight reset (all three count Pacific days). Better World Books
//        allows so many requests an hour, so its part runs all day, a little
//        each hour.
// What, in order (each night):
//   1. To buy and shelf volumes whose eBay prices are over a week old
//      (readers see these)
//   2. the popular series' volumes whose prices are over 30 days old
//   3. new series, most popular first, every volume of one before the next
//      (its box sets scanned once first)
// Each volume asks eBay (2 searches), Books-A-Million and Better World Books.
// One eBay search in five goes to Canada (eBay.ca), the same order.
//
// What's always left for visitors:
//   eBay                 30% of what's left of the day when the sweep starts
//   Books-A-Million      at least 1,000 lookups
//   Google Books         at least 300 calls (only list-building uses it)
//   Better World Books   at least 1,000 requests an hour
// And it stands aside when visitors get busy: if their pace over the last
// hour (or, for a sudden rush, the last 15 minutes) would use more than is
// kept for them before the reset, it pauses for 15 minutes and looks again
// (the pace rules are in visitorPace.ts).
//
// Never a paid search: SerpApi is nowhere in here. PRICE_SWEEP=off stops it.
// One sweep at a time even with two servers (a database lock); what's done is
// in the database, so a restart carries on where it was.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import priceQueries, { type Country } from "../models/priceQueries.js";
import { monthOf } from "../models/apiAllowance.js";
import { checkCanada } from "../prices/canada/canadaPrices.js";
import { callsSince } from "../prices/callLog.js";
import betterWorldBooks from "../prices/providers/betterWorldBooks.js";
import booksAMillion, {
  cjBudgetLabel,
  cjDay,
} from "../prices/providers/booksAMillion.js";
import ebay, {
  budgetLabel,
  ebayApiEnabled,
  ebayDay,
  ebayRefusedSince,
} from "../prices/providers/ebay.js";
import {
  checkAlone,
  fetchProviders,
  getOrCreateBook,
  knownVolumesBySeries,
  titleVolume,
} from "../prices/service.js";
import { scanIfNeverScanned } from "../prices/boxSetScan.js";
import { slugify } from "../prices/stores/match.js";
import { fillSeries } from "../prices/seriesFiller.js";
import { askUsedAbout } from "./usedFiller.js";
import {
  DAY_MS,
  fillSwitchOn,
  knownSeries,
  neverLooked,
  olderThan,
  shelfVolumes,
  startEvery,
  toBuyVolumes,
  triedLately,
} from "./fillShared.js";
import {
  gbooksRoom,
  hoursUntilReset,
  pacificClock,
  shouldBackOff,
  usersPace,
  usersWillNeed,
} from "./visitorPace.js";

// the pace rules, for the tests that read them from here
export { hoursUntilReset, shouldBackOff, usersWillNeed };

// ---------- the limits ----------

export const LIMITS = {
  // eBay: the share of what's left at sweep time kept for visitors
  ebayUsersShare: 0.3,
  // of the sweep's eBay searches, Canada's (one volume in five)
  canadaShare: 0.2,
  // Books-A-Million: lookups always left for visitors
  bamKept: 1000,
  // Better World Books (Impact): 3,000 requests an hour; this many kept
  impactHourly: 3000,
  impactKept: 1000,
  // when the night's part starts, Pacific. Four hours: at about 6 seconds a
  // volume, two weren't enough to spend the sweep's share of eBay's day
  startsAtHour: 20,
  // the gap between volumes: steady, never a burst (eBay has short-window
  // limits as well as the daily one)
  gapMs: 3_000,
  // the most volumes one run looks at: no limit, except for a short live
  // test run by hand
  mostPerRun: Infinity,
};

// ---------- the maths, kept plain so it can be tested ----------

// the most eBay's day count may reach before the sweep stops: what was used
// when it started, plus its share of what was left. Never past 80% of the
// day: there eBay's title searches stop (providers/ebay.ts), so every volume
// priced past it would get thinner results, and visitors would lose title
// searches for the rest of the night
export const TITLE_SEARCHES_STOP = 0.8;
export const sweepCeiling = (limit: number, usedAtStart: number) =>
  Math.min(
    Math.floor(limit * TITLE_SEARCHES_STOP),
    usedAtStart +
      Math.floor(
        Math.max(0, limit - usedAtStart) * (1 - LIMITS.ebayUsersShare),
      ),
  );

// whether it's the night's window (how long until the reset is
// visitorPace.ts hoursUntilReset)
export const isSweepTime = (now: number) =>
  pacificClock(now).hour >= LIMITS.startsAtHour;

// one volume in five is Canada's: 80% of the searches US, 20% Canada
export const isCanadasTurn = (done: number) =>
  done % Math.round(1 / LIMITS.canadaShare) ===
  Math.round(1 / LIMITS.canadaShare) - 1;

// an English edition's ISBN (978-0, 978-1, 979-8): Japanese and other
// editions aren't what the site prices
export const isEnglishIsbn = (isbn: string) =>
  /^(9780|9781|9798)\d{9}$/.test(isbn);

// ---------- what's been used ----------

const usedToday = async (label: string, month: string) => {
  const row = await prisma.apiUsage.findUnique({
    where: { provider_month: { provider: label, month: new Date(month) } },
  });
  return row?.calls ?? 0;
};

// tonight's eBay ceiling, worked out once when the sweep starts and kept in
// api_usage, so a restart doesn't move it
async function ebayCeiling(day: string) {
  const label = `sweep-ceiling:${day}`;
  const saved = await usedToday(label, monthOf(day));
  if (saved) return saved;
  const used = await usedToday(budgetLabel(day), monthOf(day));
  const ceiling = sweepCeiling(config.EBAY_DAILY_LIMIT, used);
  await prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${label}, ${monthOf(day)}::date, ${ceiling})
    ON CONFLICT (provider, month) DO NOTHING
  `;
  return usedToday(label, monthOf(day));
}

// Whether eBay has room for the sweep now: under tonight's ceiling, and
// visitors not about to need what's kept for them
export async function ebayRoom(now = Date.now()) {
  const day = ebayDay(new Date(now));
  const ceiling = await ebayCeiling(day);
  const used = await usedToday(budgetLabel(day), monthOf(day));
  if (used >= ceiling) return "spent" as const;
  // kept for visitors tonight: everything above the ceiling. Their calls
  // since the sweep began already moved the day's count toward the ceiling
  // (taking from the sweep's share), so they aren't taken off this too
  const keptLeft = config.EBAY_DAILY_LIMIT - ceiling;
  const pace = await usersPace("ebay", now);
  const willNeed = usersWillNeed(
    pace.lastHour,
    pace.last15,
    hoursUntilReset(now),
  );
  return shouldBackOff(willNeed, keptLeft)
    ? ("busy" as const)
    : ("ok" as const);
}

// whether Books-A-Million can be asked too: more than its 1,000 kept, and
// visitors not about to need them
async function bamRoom(now: number) {
  if (!booksAMillion.enabled()) return false;
  const day = cjDay(new Date(now));
  const used = await usedToday(cjBudgetLabel(day), monthOf(day));
  const left = config.CJ_DAILY_LIMIT - used;
  if (left <= LIMITS.bamKept) return false;
  const pace = await usersPace("cj", now);
  return !shouldBackOff(
    usersWillNeed(pace.lastHour, pace.last15, hoursUntilReset(now)),
    LIMITS.bamKept,
  );
}

// whether Better World Books has room this hour: the sweep's own under
// 2,000, and visitors under their 1,000
async function impactRoom(now: number) {
  if (!betterWorldBooks.enabled()) return false;
  const hourAgo = now - 60 * 60_000;
  const [ours, theirs] = await Promise.all([
    callsSince("impact", "bg", hourAgo, now),
    callsSince("impact", "user", hourAgo, now),
  ]);
  return (
    ours < LIMITS.impactHourly - LIMITS.impactKept &&
    theirs <= LIMITS.impactKept
  );
}

// ---------- what to price, in order ----------

// whole-numbered volumes out now with an English ISBN, in order: the ones
// the site prices. A series with none of these is skipped (its list is
// unsure: specials only, or another language)
type PricedVolume = { isbn13: string; title: string; volume: number };
function pricedVolumesOf(
  known: { isbn13: string; title: string; published?: string | null }[],
  today: string,
): PricedVolume[] {
  return known
    .map((v) => ({
      isbn13: v.isbn13.trim(),
      title: v.title,
      number: titleVolume(v.title),
      published: v.published,
    }))
    .filter(
      (v) =>
        v.number != null &&
        v.number >= 1 &&
        Number.isInteger(v.number) &&
        isEnglishIsbn(v.isbn13) &&
        (!v.published || v.published.slice(0, 10) <= today),
    )
    .sort((a, b) => a.number! - b.number!)
    .map((v) => ({ isbn13: v.isbn13, title: v.title, volume: v.number! }));
}

const POPULAR_SERIES = 150;
const MOST_IN_A_QUEUE = 400;

// the series in popularity order, each with the volumes the site prices
async function seriesInOrder(now: Date) {
  const [series, bySeries] = await Promise.all([
    knownSeries(),
    knownVolumesBySeries(),
  ]);
  const today = now.toISOString().slice(0, 10);
  return series
    .filter((s) => s.popularityRank != null)
    .sort((a, b) => a.popularityRank! - b.popularityRank!)
    .map((s) => ({
      name: s.name,
      volumes: pricedVolumesOf(
        [...(bySeries.get(slugify(s.name))?.values() ?? [])],
        today,
      ),
    }))
    .filter((s) => s.volumes.length > 0);
}

// The next series to explore: the first, in popularity order, with a volume
// never looked at that's due, and those volumes in order. A series whose only
// unpriced volumes failed lately is passed over until they're due again
export function nextSeries<
  S extends { name: string; volumes: { isbn13: string }[] },
>(ordered: S[], never: Set<string>, isDue: (isbn: string) => boolean) {
  const waiting = (series: S) =>
    series.volumes
      .map((v) => v.isbn13)
      .filter((isbn) => never.has(isbn) && isDue(isbn));
  const series = ordered.find((s) => waiting(s).length > 0) ?? null;
  return { series, explore: series ? waiting(series) : [] };
}

// What to price next in a country, in the night's order: stale To buy and
// shelf volumes, stale popular ones, then the next new series whole. `series` is
// the one being explored, so its box sets can be scanned first. `isDue`
// leaves out volumes that failed lately (triedLately): a series whose only
// unpriced volumes failed steps aside, and the next one gets its turn
export async function sweepQueue(
  country: Country,
  now = new Date(),
  isDue: (isbn: string) => boolean = () => true,
) {
  const ordered = await seriesInOrder(now);
  const [wanted, { owned, missing }] = await Promise.all([
    toBuyVolumes(now),
    shelfVolumes(now),
  ]);
  const shelf = [...wanted, ...owned, ...missing].filter(isEnglishIsbn);
  const popular = ordered
    .slice(0, POPULAR_SERIES)
    .flatMap((s) => s.volumes.map((v) => v.isbn13));
  const [staleShelf, stalePopular] = await Promise.all([
    olderThan(shelf, 7 * DAY_MS, country),
    olderThan(popular, 30 * DAY_MS, country),
  ]);
  const refresh = [...new Set([...staleShelf, ...stalePopular])]
    .filter(isDue)
    .slice(0, MOST_IN_A_QUEUE);
  // the next new series: the first in order with a volume never looked at
  // that's due. One question for every series' volumes, not one per series
  const never = new Set(
    await neverLooked(
      ordered.flatMap((s) => s.volumes.map((v) => v.isbn13)),
      "ebay",
      country,
    ),
  );
  const { series, explore } = nextSeries(ordered, never, isDue);
  // refreshing first, then the new series
  return { isbns: [...new Set([...refresh, ...explore])], series };
}

// ---------- pricing one volume ----------

// a US volume: eBay (2 searches), and Books-A-Million and Better World Books
// when they have room. Saved as a background check ("fill")
// Books-A-Million and Better World Books only when their own prices are over
// 3 days old: a fresh price isn't worth one of the day's lookups
const FREE_STORE_FRESH_MS = 3 * DAY_MS;
// Whether a country's eBay look at a volume was saved since then: a failed
// look (a timeout, an outage, eBay refusing) saves nothing
async function ebaySavedSince(isbn13: string, country: Country, since: number) {
  const at = (await priceQueries.getSourceChecks(isbn13, country)).get("ebay");
  return Boolean(at && at.getTime() >= since);
}

async function priceInUs(isbn13: string, now: number) {
  const [bam, impact, looked] = await Promise.all([
    bamRoom(now),
    impactRoom(now),
    priceQueries.getSourceChecks(isbn13),
  ]);
  const due = (group: string) => {
    const at = looked.get(group);
    return !at || now - at.getTime() >= FREE_STORE_FRESH_MS;
  };
  const providers = [
    ebay,
    ...(bam && due("books-a-million") ? [booksAMillion] : []),
    ...(impact && due("better-world-books") ? [betterWorldBooks] : []),
  ];
  await checkAlone(isbn13, async () => {
    const book = await getOrCreateBook(isbn13);
    if (book)
      await fetchProviders(isbn13, book, providers, { background: true });
  });
}

// Canada's check needs the book's own row, which a volume nobody has opened
// may not have yet: made first, from its series' saved list, as the US
// check does
async function priceInCanada(isbn13: string) {
  if (!(await getOrCreateBook(isbn13))) return;
  await checkCanada(isbn13, ["ebay"], { background: true });
}

// ---------- a run ----------

// how long one run keeps pricing (the gap between volumes is LIMITS.gapMs)
const RUN_MS = 100_000;
// the most one volume takes (eBay's own timeout), and building a series' list
const VOLUME_MS = 20_000;
const LIST_MS = 45_000;
const PAUSE_MS = 15 * 60_000;
const EVERY_MS = 2 * 60_000;

export const sweepOn = () =>
  fillSwitchOn() && config.PRICE_SWEEP !== "off" && ebayApiEnabled();

let pausedUntil = 0;
let done = 0;
const tried = { us: triedLately(), ca: triedLately() };
const queues: Record<Country, { at: number; isbns: string[] }> = {
  us: { at: 0, isbns: [] },
  ca: { at: 0, isbns: [] },
};
const QUEUE_MS = 30 * 60_000;

export const resetSweep = () => {
  pausedUntil = 0;
  done = 0;
  tried.us.clear();
  tried.ca.clear();
  queues.us = { at: 0, isbns: [] };
  queues.ca = { at: 0, isbns: [] };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rebuild(country: Country, now: number) {
  const queue = await sweepQueue(country, new Date(now), (isbn) =>
    tried[country].isDue(isbn, now),
  );
  queues[country] = { at: now, isbns: queue.isbns };
  // a new series: its box sets first, once
  if (queue.series)
    await scanIfNeverScanned(
      queue.series.name,
      queue.series.volumes,
      country,
    ).catch(() => {});
}

const firstDue = (country: Country, now: number) =>
  queues[country].isbns.find((i) => tried[country].isDue(i, now)) ?? null;

// The next volume for a country. Its queue is rebuilt every half hour, and at
// once when everything in it has had its turn: a finished series goes
// straight on to the next
async function nextFor(country: Country, now: number) {
  if (now - queues[country].at > QUEUE_MS) await rebuild(country, now);
  let isbn = firstDue(country, now);
  if (!isbn && queues[country].at !== now) {
    await rebuild(country, now);
    isbn = firstDue(country, now);
  }
  if (isbn) tried[country].mark(isbn, now);
  return isbn;
}

// Better World Books' part, any hour: the popular series' volumes it has
// never been asked about, 200 at a time (4 requests)
async function usedPart(now: number) {
  if (!(await impactRoom(now))) return 0;
  const ordered = await seriesInOrder(new Date(now));
  const waiting = await neverLooked(
    ordered
      .slice(0, POPULAR_SERIES)
      .flatMap((s) => s.volumes.map((v) => v.isbn13)),
    "better-world-books",
  );
  if (!waiting.length) return 0;
  return askUsedAbout(waiting.slice(0, 200), AbortSignal.timeout(30_000));
}

// One run, every two minutes. What happened, for the logs and the tests
export async function sweepOnce(
  now = Date.now(),
): Promise<
  | "off"
  | "paused"
  | "busy"
  | "refused"
  | "waiting"
  | "spent"
  | { priced: number }
> {
  if (!sweepOn()) return "off";
  // a pause is real time, whatever moment the run is asked about
  if (Date.now() < pausedUntil) return "paused";
  // the run's clock starts here, so everything it does fits inside its lock
  const started = Date.now();
  const timeLeft = () => RUN_MS - (Date.now() - started);
  // the moment of the night the run is about, moving on as it goes: the
  // time it was asked about, plus how long it's been running. In production
  // that's the real time; a test asks about 10:30pm and gets that, whatever
  // the hour it runs at. (A pause, the run's length and what was saved since
  // stay on the real clock: they're about the database's own times)
  const runTime = () => now + (Date.now() - started);
  await usedPart(now).catch(() => 0);
  if (!isSweepTime(now)) return "waiting";

  let priced = 0;
  let builtAList = false;
  // a country with nothing left this run: its turns go to the other
  const nothingLeft = new Set<Country>();
  if (config.CANADA_PRICES === "off") nothingLeft.add("ca");
  // room for one more volume (eBay's timeout is 15 seconds)
  let tries = 0;
  while (timeLeft() > VOLUME_MS && tries < LIMITS.mostPerRun) {
    const room = await ebayRoom(runTime());
    if (room === "spent") return priced ? { priced } : "spent";
    if (room === "busy") {
      pausedUntil = Date.now() + PAUSE_MS;
      return priced ? { priced } : "busy";
    }
    let country: Country = isCanadasTurn(done) ? "ca" : "us";
    done++;
    if (nothingLeft.has(country)) country = country === "us" ? "ca" : "us";
    if (nothingLeft.has(country)) break;
    const isbn = await nextFor(country, runTime());
    if (!isbn) {
      // nothing left that has a list: build the next series' list, once a
      // run, when Google Books has calls to spare
      if (
        !builtAList &&
        timeLeft() > LIST_MS &&
        (await gbooksRoom(runTime()))
      ) {
        builtAList = true;
        await fillSeries().catch(() => null);
      }
      nothingLeft.add(country);
      continue;
    }
    // the daily job (filler.ts) works through stale volumes too, and runs at
    // night: one it priced since this queue was built is left alone
    if (await ebaySavedSince(isbn, country, Date.now() - FREE_STORE_FRESH_MS))
      continue;
    tries++;
    const before = Date.now();
    if (country === "us") await priceInUs(isbn, before);
    else await priceInCanada(isbn);
    // eBay said no (too many calls in a short window, or the day): stop and
    // wait, and this volume wasn't really tried, so it keeps its turn.
    // Going on would only fail every volume after it
    if (ebayRefusedSince(before)) {
      tried[country].unmark(isbn);
      pausedUntil = Date.now() + PAUSE_MS;
      return priced ? { priced } : "refused";
    }
    // only a look that was saved counts as priced
    if (await ebaySavedSince(isbn, country, before)) priced++;
    await sleep(LIMITS.gapMs);
  }
  return { priced };
}

// One sweep at a time, across every server: a run holds a database lock
// while it works, and another server's run just skips its turn. The lock
// belongs to the run's transaction, so it's let go when the run ends, even
// if the server dies mid-run
const LOCK_KEY = "nightly-price-sweep";
const lockedRun = () =>
  prisma.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<{ got: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${LOCK_KEY})) AS got`;
      if (!lock?.got) return "locked" as const;
      return sweepOnce();
    },
    // the run's own time (it stops starting work in time to finish), and a
    // wide margin
    { timeout: RUN_MS + 80_000, maxWait: 10_000 },
  );

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startSweep() {
  if (timer || !sweepOn()) return;
  timer = startEvery(
    "Nightly price sweep",
    async () => {
      const result = await lockedRun();
      if (typeof result === "object" && result.priced)
        console.log(`Nightly price sweep: priced ${result.priced} volumes`);
    },
    { everyMs: EVERY_MS, firstAfterMs: 120_000 },
  );
  console.log(
    `Nightly price sweep on: from ${LIMITS.startsAtHour}:00 Pacific, leaving visitors 30% of what's left of eBay's day`,
  );
}
