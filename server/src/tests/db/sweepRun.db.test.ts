// The nightly sweep run end to end (collector/sweep.ts sweepOnce), with a
// real database and a fake eBay: what happens when eBay answers, when one
// volume fails, and when eBay says "too many calls". eBay itself is never
// called (fetch is replaced), Books-A-Million and Better World Books have no
// keys here, and Google Books is made to look used up, so nothing else is
// called either.
import config from "../../config/config.js";
import { LIMITS, resetSweep, sweepOnce } from "../../collector/sweep.js";
import { noteCall } from "../../prices/callLog.js";
import { resetEbaySync } from "../../prices/providers/ebay.js";
import { forgetKnownVolumes } from "../../prices/service.js";
import { volumesKey } from "../../prices/volumesKey.js";
import priceQueries from "../../models/priceQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";
import { todayInPacificAt } from "./testClock.js";

// two series, the first the more popular
const ALPHA = "Zzsweep Alpha";
const BETA = "Zzsweep Beta";
const isbnOf = (series: string, n: number) =>
  `97819999${series === ALPHA ? "92" : "93"}00${n}`;
const book = (series: string, n: number) => ({
  isbn13: isbnOf(series, n),
  title: `${series}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
});
const ALL = [
  ...[1, 2, 3].map((n) => isbnOf(ALPHA, n)),
  ...[1, 2].map((n) => isbnOf(BETA, n)),
];
const titleOf = new Map(
  [ALPHA, BETA].flatMap((s) =>
    [1, 2, 3].map((n) => [isbnOf(s, n), `${s}, Vol. ${n}`] as const),
  ),
);

// 10:30pm Pacific today, the sweep's time, from the real clock: the rows it
// saves carry the real time, so a fixed date stops matching once the day
// moves on (testClock.ts)
const NIGHT = todayInPacificAt(22, 30);

// the fake eBay. `failing`: ISBNs whose search fails; `refuse`: every search
// answered 429 (a short window: eBay's daily count is still low)
let failing = new Set<string>();
let refuse = false;
const realFetch = globalThis.fetch;
const fakeEbay = () => {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/oauth2/token"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 7200 }),
      );
    if (u.includes("/rate_limit"))
      return new Response(
        JSON.stringify({
          rateLimits: [
            {
              resources: [
                {
                  name: "buy.browse",
                  rates: [
                    {
                      count: 10,
                      timeWindow: 86_400,
                      reset: new Date(Date.now() + 12 * 3600_000).toISOString(),
                    },
                  ],
                },
              ],
            },
          ],
        }),
      );
    if (refuse) return new Response("{}", { status: 429 });
    const q = new URL(u).searchParams.get("q") ?? "";
    if (failing.has(q)) return new Response("{}", { status: 500 });
    // one used copy for an ISBN search; nothing for the rest
    const items = titleOf.has(q)
      ? [
          {
            title: titleOf.get(q),
            conditionId: "3000",
            price: { value: "6.00", currency: "USD" },
            shippingOptions: [{ shippingCost: { value: "0.00" } }],
            itemWebUrl: `https://www.ebay.com/itm/${q}`,
          },
        ]
      : [];
    return new Response(JSON.stringify({ itemSummaries: items }));
  }) as typeof fetch;
};

const saved = {
  PRICE_FILL: config.PRICE_FILL,
  PRICE_SWEEP: config.PRICE_SWEEP,
  EBAY_CLIENT_ID: config.EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET: config.EBAY_CLIENT_SECRET,
  COLLECTOR_TOOLS: config.COLLECTOR_TOOLS,
  CANADA_PRICES: config.CANADA_PRICES,
  EBAY_DAILY_LIMIT: config.EBAY_DAILY_LIMIT,
};
const gapMs = LIMITS.gapMs;

const clean = async () => {
  await prisma.book.deleteMany({ where: { isbn13: { in: ALL } } });
  await prisma.caPriceSample.deleteMany({ where: { isbn13: { in: ALL } } });
  await prisma.caPriceSourceCheck.deleteMany({
    where: { isbn13: { in: ALL } },
  });
  await prisma.caPriceCheck.deleteMany({ where: { isbn13: { in: ALL } } });
  await prisma.seriesVolumes.deleteMany({
    where: { key: { startsWith: volumesKey("Zzsweep") } },
  });
  for (const series of [ALPHA, BETA])
    await prisma.seriesVolumes.deleteMany({
      where: { key: { startsWith: volumesKey(series) } },
    });
  await prisma.seriesInfo.deleteMany({
    where: { slug: { in: ["zzsweep-alpha", "zzsweep-beta"] } },
  });
};

// which of these volumes a country's eBay has looked at
const looked = async (country: "us" | "ca") => {
  const out: string[] = [];
  for (const isbn of ALL)
    if ((await priceQueries.getSourceChecks(isbn, country)).has("ebay"))
      out.push(isbn);
  return out;
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  resetSweep();
  resetEbaySync();
  failing = new Set();
  refuse = false;
  LIMITS.gapMs = 0;
  Object.assign(config, {
    PRICE_FILL: "on",
    PRICE_SWEEP: undefined,
    EBAY_CLIENT_ID: "test-id",
    EBAY_CLIENT_SECRET: "test-secret",
    COLLECTOR_TOOLS: "on",
    CANADA_PRICES: "off",
    EBAY_DAILY_LIMIT: 4500,
  });
  for (const [series, rank, volumes] of [
    [ALPHA, 0, 3],
    [BETA, 1, 2],
  ] as const) {
    const slug = series.toLowerCase().replace(/ /g, "-");
    await prisma.seriesInfo.create({
      data: {
        slug,
        info: {
          anilistId: -9900 - rank,
          name: series,
          popularityRank: rank,
          altNames: [],
        },
      },
    });
    await priceQueries.saveSeriesVolumes(
      volumesKey(series),
      Array.from({ length: volumes }, (_, i) => book(series, i + 1)),
    );
  }
  forgetKnownVolumes();
  // Google Books looks used up, so no series list is built from the network
  await noteCall("gbooks", 1000);
  fakeEbay();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, saved);
  LIMITS.gapMs = gapMs;
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("it prices one series whole, then the next, and counts what it priced", async () => {
  const result = await sweepOnce(NIGHT);
  expect(result).toEqual({ priced: 5 });
  expect((await looked("us")).sort()).toEqual([...ALL].sort());
}, 60_000);

test("Canada gets its share of the same series, from eBay.ca", async () => {
  config.CANADA_PRICES = "on";
  const result = await sweepOnce(NIGHT);
  expect(result).toEqual({ priced: 10 });
  expect((await looked("ca")).sort()).toEqual([...ALL].sort());
}, 60_000);

test("one failed volume doesn't stop the next series being explored", async () => {
  // Alpha's vol. 2 fails every time: Alpha's other volumes are priced, then
  // Beta's, the same night
  failing = new Set([isbnOf(ALPHA, 2)]);
  const result = await sweepOnce(NIGHT);
  // only the looks that were saved count
  expect(result).toEqual({ priced: 4 });
  const us = await looked("us");
  expect(us).not.toContain(isbnOf(ALPHA, 2));
  expect(us).toEqual(
    expect.arrayContaining([isbnOf(BETA, 1), isbnOf(BETA, 2)]),
  );
}, 60_000);

test("eBay saying too many calls stops the run, and the volume keeps its turn", async () => {
  refuse = true;
  expect(await sweepOnce(NIGHT)).toBe("refused");
  // nothing was saved, and the run waits rather than trying again at once
  expect(await looked("us")).toEqual([]);
  expect(await sweepOnce(NIGHT)).toBe("paused");
  // a short window, not the day: eBay's day isn't closed
  const day = await prisma.apiUsage.findMany({
    where: { provider: { startsWith: "ebay:2" } },
  });
  expect(day.every((row) => row.calls < 4500)).toBe(true);
  // once eBay answers again, that same volume is priced first
  refuse = false;
  resetSweep();
  await sweepOnce(NIGHT);
  expect(await looked("us")).toContain(isbnOf(ALPHA, 1));
}, 60_000);

// (the case of one priced after the queue was built is guarded in sweepOnce,
// ebaySavedSince; it can't be set up from outside a run)
test("a volume another job already priced isn't priced again", async () => {
  // Alpha's vol. 1 was just priced by someone else
  await priceQueries.upsertBook(book(ALPHA, 1));
  await priceQueries.saveCheck(
    isbnOf(ALPHA, 1),
    ["ebay"],
    new Map([["ebay", []]]),
  );
  const result = await sweepOnce(NIGHT);
  // the other four, not that one again
  expect(result).toEqual({ priced: 4 });
}, 60_000);
