// Background pricing (collector/filler.ts) with a real database and a fake
// eBay: it prices shelf volumes eBay has never looked at, owned ones first,
// a daily share at a time, and stays off when told to. eBay itself is never
// called: fetch is replaced.
import config from "../../config/config.js";
import {
  fillLabel,
  fillOne,
  fillQueue,
  popularQueue,
  resetFiller,
  staleQueue,
} from "../../collector/filler.js";
import { forgetKnownVolumes } from "../../prices/service.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { budgetLabel, resetEbaySync } from "../../prices/providers/ebay.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const SERIES = "Zzfiller Test Series";
const ISBN = (n: number) => `978199999100${n}`;
const book = (n: number) => ({
  isbn13: ISBN(n),
  title: `${SERIES}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
});

const realFetch = globalThis.fetch;
let searched: string[] = [];
const fakeEbay = () => {
  searched = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/oauth2/token"))
      return new Response(
        JSON.stringify({ access_token: "t", expires_in: 7200 }),
      );
    if (u.includes("/rate_limit")) return new Response("{}", { status: 500 });
    const q = new URL(u).searchParams.get("q") ?? "";
    searched.push(q);
    // one used copy, for the ISBN search only
    const items = /^\d{13}$/.test(q)
      ? [
          {
            title: `${SERIES}, Vol. ${Number(q.slice(-1))}`,
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
  PRICE_FILL_DAILY: config.PRICE_FILL_DAILY,
  EBAY_CLIENT_ID: config.EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET: config.EBAY_CLIENT_SECRET,
  COLLECTOR_TOOLS: config.COLLECTOR_TOOLS,
};
const clean = async () => {
  await prisma.seriesVolumes.deleteMany({
    where: { key: volumesKey(SERIES) },
  });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [1, 2, 3, 9].map(ISBN) } },
  });
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  resetFiller();
  resetEbaySync();
  Object.assign(config, {
    PRICE_FILL: "on",
    PRICE_FILL_DAILY: 160,
    EBAY_CLIENT_ID: "test-id",
    EBAY_CLIENT_SECRET: "test-secret",
    COLLECTOR_TOOLS: "on",
  });
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    book(1),
    book(2),
    book(3),
    // a book in the list with no volume number: never priced in the background
    { ...book(9), title: `${SERIES} Official Guidebook`, volume: null },
  ]);
  // a reader owning vol 2: it goes first
  const userId = await userQueries.addUser("filler", "a good password");
  await prisma.manga.create({
    data: { userId: userId!, name: SERIES, ownedList: [2], volumesOwned: 2 },
  });
  fakeEbay();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, saved);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the queue: numbered volumes eBay never looked at, owned ones first", async () => {
  // the guidebook (no volume number) isn't in it
  expect(await fillQueue()).toEqual([ISBN(2), ISBN(1), ISBN(3)]);
});

test("each run prices one volume as a page visit would, then moves on", async () => {
  expect(await fillOne()).toEqual({ isbn13: ISBN(2) });
  // saved like any eBay check: its price and the group's look
  const offers = await priceQueries.getCurrentOffers(ISBN(2));
  expect(offers.map((o) => [o.store, o.condition, o.priceCents])).toEqual([
    ["eBay", "used", 600],
  ]);
  expect((await priceQueries.getSourceChecks(ISBN(2))).has("ebay")).toBe(true);
  // its ISBN search, plus the two title searches
  expect(searched).toContain(ISBN(2));
  // looked at now: out of the queue once it's rebuilt
  resetFiller();
  expect(await fillQueue()).toEqual([ISBN(1), ISBN(3)]);
  expect(await fillOne()).toEqual({ isbn13: ISBN(1) });
});

test("the daily share stops it", async () => {
  config.PRICE_FILL_DAILY = 1;
  expect(await fillOne()).toEqual({ isbn13: ISBN(2) });
  expect(await fillOne()).toBe("done");
  const [row] = await prisma.$queryRaw<{ calls: number }[]>`
    SELECT calls FROM api_usage WHERE provider = ${fillLabel()}`;
  expect(row?.calls).toBe(1);
});

test("with eBay's calls used up for today, it waits", async () => {
  await priceQueries.markApiSpent(budgetLabel(), config.EBAY_DAILY_LIMIT);
  expect(await fillOne()).toBe("budget");
  expect(searched).toEqual([]);
});

test("off: by the switch, without eBay keys, or outside production by default", async () => {
  config.PRICE_FILL = "off";
  expect(await fillOne()).toBe("off");
  config.PRICE_FILL = "on";
  config.EBAY_CLIENT_ID = undefined;
  expect(await fillOne()).toBe("off");
  config.EBAY_CLIENT_ID = "test-id";
  config.PRICE_FILL = undefined;
  // the tests run as DEV
  expect(await fillOne()).toBe("off");
  config.COLLECTOR_TOOLS = "off";
  config.PRICE_FILL = "on";
  expect(await fillOne()).toBe("off");
  expect(searched).toEqual([]);
});

test("a background check stays out of the home page's recently checked", async () => {
  // a new copy too, so it would otherwise qualify for the row
  await fillOne();
  await priceQueries.saveCheck(
    ISBN(2),
    ["ebay", "fill"],
    new Map([
      [
        "ebay",
        [
          {
            store: "eBay",
            format: "print",
            condition: "new",
            priceCents: 999,
            currency: "USD",
            inStock: true,
            url: "https://www.ebay.com/itm/1",
          },
        ],
      ],
    ]),
  );
  const recent = await priceQueries.getRecentBestPrices(200);
  expect(recent.map((r) => r.isbn13.trim())).not.toContain(ISBN(2));
  // once someone opens it (a check without the mark), it shows
  await priceQueries.saveCheck(
    ISBN(2),
    ["ebay"],
    new Map([
      [
        "ebay",
        [
          {
            store: "eBay",
            format: "print",
            condition: "new",
            priceCents: 998,
            currency: "USD",
            inStock: true,
            url: "https://www.ebay.com/itm/2",
          },
        ],
      ],
    ]),
  );
});

test("another server pricing the same volume holds it: no second check", async () => {
  // another server holds the volume's lock for the length of this test
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const other = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`price-fill:${ISBN(2)}`}))`;
      await held;
    },
    { timeout: 20_000 },
  );
  await new Promise((r) => setTimeout(r, 200));
  expect(await fillOne()).toEqual({ isbn13: ISBN(2) });
  // it stood aside: nothing searched, nothing saved
  expect(searched).toEqual([]);
  expect((await priceQueries.getSourceChecks(ISBN(2))).has("ebay")).toBe(false);
  release();
  await other;
});

test("then priced volumes whose eBay look is over 3 days old, oldest first", async () => {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  for (const n of [1, 2, 3]) {
    await prisma.book.upsert({
      where: { isbn13: ISBN(n) },
      create: { isbn13: ISBN(n), title: `${SERIES}, Vol. ${n}` },
      update: {},
    });
  }
  await prisma.priceSourceCheck.createMany({
    data: [
      { isbn13: ISBN(1), source: "ebay", checkedAt: daysAgo(4) },
      { isbn13: ISBN(2), source: "ebay", checkedAt: daysAgo(10) },
      // looked at yesterday: still fresh
      { isbn13: ISBN(3), source: "ebay", checkedAt: daysAgo(1) },
    ],
  });
  expect(await staleQueue(now)).toEqual([ISBN(2), ISBN(1)]);
  // and a volume eBay has looked at lately isn't asked again
  expect(await fillQueue(now)).toEqual([]);
});

test("then the most popular series' unpriced volumes, in order, out now only", async () => {
  const slug = "zzfiller-test-series";
  await prisma.seriesInfo.upsert({
    where: { slug },
    create: {
      slug,
      info: { anilistId: -991, name: SERIES, popularityRank: 0, altNames: [] },
    },
    update: {
      info: { anilistId: -991, name: SERIES, popularityRank: 0, altNames: [] },
    },
  });
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    book(2),
    book(1),
    // not out yet: not priced
    { ...book(3), published: "2999-01-01" },
  ]);
  forgetKnownVolumes();
  try {
    const queue = await popularQueue();
    const ours = queue.filter((i) => [1, 2, 3].map(ISBN).includes(i));
    expect(ours).toEqual([ISBN(1), ISBN(2)]);
  } finally {
    await prisma.seriesInfo.delete({ where: { slug } });
  }
});

// ---------- Better World Books: one look per shelf volume, then kept ----------

// Impact's catalog search, faked: a used copy at $4.00 for every ISBN asked
let impactAsked: string[] = [];
const withFakeImpact = () => {
  impactAsked = [];
  Object.assign(config, {
    IMPACT_ACCOUNT_SID: "IRtest",
    IMPACT_AUTH_TOKEN: "token",
  });
  const ebayOnly = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes("api.impact.com")) return ebayOnly(url, init);
    const isbns = new URL(u).searchParams.get("Query")?.match(/\d{13}/g) ?? [];
    impactAsked.push(...isbns);
    return new Response(
      JSON.stringify({
        Items: isbns.map((Gtin) => ({
          Gtin,
          CurrentPrice: "4.00",
          Currency: "USD",
          Condition: "Used",
          StockAvailability: "InStock",
          Url: `https://betterworldbooks.pxf.io/c/1/2/3?prodsku=${Gtin}`,
        })),
      }),
    );
  }) as typeof fetch;
};
const withoutImpact = () =>
  Object.assign(config, {
    IMPACT_ACCOUNT_SID: undefined,
    IMPACT_AUTH_TOKEN: undefined,
  });
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

test("Better World Books is asked once per shelf volume, and its price is kept", async () => {
  withFakeImpact();
  try {
    // a shelf volume nobody has looked at: eBay and Better World Books both
    expect(await fillOne()).toEqual({ isbn13: ISBN(2) });
    expect(impactAsked).toEqual([ISBN(2)]);
    const first = await priceQueries.getCurrentOffers(ISBN(2));
    expect(
      first.map((o) => [o.store, o.condition, o.priceCents]).sort(),
    ).toEqual([
      ["Better World Books", "used", 400],
      ["eBay", "used", 600],
    ]);

    // days later eBay's look is old, so the volume comes round again: eBay
    // is asked, Better World Books is not
    await prisma.priceSourceCheck.updateMany({
      where: { isbn13: ISBN(2), source: "ebay" },
      data: { checkedAt: daysAgo(4) },
    });
    resetFiller();
    searched = [];
    const later = Date.now() + 2 * 24 * 60 * 60 * 1000;
    const done: string[] = [];
    for (let run = 0; run < 3; run++) {
      const result = await fillOne(later + run);
      if (typeof result === "object") done.push(result.isbn13);
    }
    expect(done).toContain(ISBN(2));
    expect(searched).toContain(ISBN(2));
    expect(impactAsked.filter((isbn) => isbn === ISBN(2))).toHaveLength(1);
    // and the price it found the first time is still there
    const kept = await priceQueries.getCurrentOffers(ISBN(2));
    expect(kept.some((o) => o.store === "Better World Books")).toBe(true);
  } finally {
    withoutImpact();
  }
});

test("a volume eBay already looked at still gets its one Better World Books look", async () => {
  // as on the day the source is switched on: eBay has priced the shelf
  await fillOne();
  await fillOne();
  await fillOne();
  expect(await fillQueue()).toEqual([]);
  withFakeImpact();
  try {
    resetFiller();
    searched = [];
    // every shelf volume is waiting again, for Better World Books alone
    expect(await fillQueue()).toEqual([ISBN(2), ISBN(1), ISBN(3)]);
    expect(await fillOne()).toEqual({ isbn13: ISBN(2) });
    expect(impactAsked).toEqual([ISBN(2)]);
    // eBay's look is fresh: it isn't asked again
    expect(searched).toEqual([]);
    resetFiller();
    expect(await fillQueue()).toEqual([ISBN(1), ISBN(3)]);
  } finally {
    withoutImpact();
  }
});
