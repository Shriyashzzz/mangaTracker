// Background pricing (collector/filler.ts) with a real database and a fake
// eBay: it prices shelf volumes eBay has never looked at, owned ones first,
// a daily share at a time, and stays off when told to. eBay itself is never
// called: fetch is replaced.
import config from "../../config/config.js";
import {
  fillLabel,
  fillOne,
  fillQueue,
  resetFiller,
} from "../../collector/filler.js";
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
