// Used prices for a shelf, quickly (collector/usedFiller.ts), with a real
// database and a fake Impact: every shelf volume is asked about once, many
// to a request, owned ones first; what came back is kept, "not there"
// included, so nothing is asked twice. Impact itself is never called: fetch
// is replaced.
import config from "../../config/config.js";
import {
  fillUsedOnce,
  usedFillerOn,
  usedQueue,
} from "../../collector/usedFiller.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { forgetKnownVolumes } from "../../prices/service.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const SERIES = "Zzused Test Series";
const ISBN = (n: number) => `978199999200${n}`;
const book = (n: number) => ({
  isbn13: ISBN(n),
  title: `${SERIES}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
});

// Impact's catalog search, faked: a used copy at $4.00 for the volumes in
// `stocked`, nothing for the rest. Each request's ISBNs are kept
const realFetch = globalThis.fetch;
let requests: string[][] = [];
let stocked = new Set<string>();
const fakeImpact = () => {
  requests = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (!u.includes("api.impact.com")) throw new Error(`unexpected call: ${u}`);
    const isbns = new URL(u).searchParams.get("Query")?.match(/\d{13}/g) ?? [];
    requests.push(isbns);
    return new Response(
      JSON.stringify({
        Items: isbns
          .filter((isbn) => stocked.has(isbn))
          .map((Gtin) => ({
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

const saved = {
  PRICE_FILL: config.PRICE_FILL,
  COLLECTOR_TOOLS: config.COLLECTOR_TOOLS,
  IMPACT_ACCOUNT_SID: config.IMPACT_ACCOUNT_SID,
  IMPACT_AUTH_TOKEN: config.IMPACT_AUTH_TOKEN,
};
const clean = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: volumesKey(SERIES) } });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [1, 2, 3, 9].map(ISBN) } },
  });
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  forgetKnownVolumes();
  Object.assign(config, {
    PRICE_FILL: "on",
    COLLECTOR_TOOLS: "on",
    IMPACT_ACCOUNT_SID: "IRtest",
    IMPACT_AUTH_TOKEN: "token",
  });
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    book(1),
    book(2),
    book(3),
    // in the list with no volume number: never part of a shelf's worth
    { ...book(9), title: `${SERIES} Official Guidebook`, volume: null },
  ]);
  // a reader who owns vol. 2: it goes first
  const userId = await userQueries.addUser("usedfiller", "a good password");
  await prisma.manga.create({
    data: { userId: userId!, name: SERIES, ownedList: [2], volumesOwned: 2 },
  });
  stocked = new Set([ISBN(1), ISBN(2)]);
  fakeImpact();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, saved);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the queue: every numbered shelf volume not asked about yet, owned first", async () => {
  expect(await usedQueue()).toEqual([ISBN(2), ISBN(1), ISBN(3)]);
});

test("one run asks about the whole shelf in one request, and keeps the answers", async () => {
  expect(await fillUsedOnce()).toEqual({ asked: 3, found: 2 });
  // all three volumes went in a single request
  expect(requests).toEqual([[ISBN(2), ISBN(1), ISBN(3)]]);

  // the two they stock have a used price
  for (const n of [1, 2]) {
    const offers = await priceQueries.getCurrentOffers(ISBN(n));
    expect(offers.map((o) => [o.store, o.condition, o.priceCents])).toEqual([
      ["Better World Books", "used", 400],
    ]);
  }
  // the one they don't has none, and is marked as looked at all the same
  expect(await priceQueries.getCurrentOffers(ISBN(3))).toEqual([]);
  for (const n of [1, 2, 3])
    expect(
      (await priceQueries.getSourceChecks(ISBN(n))).has("better-world-books"),
    ).toBe(true);

  // it's the used price a shelf's worth is counted from
  const worth = await priceQueries.getRecordedMedians([ISBN(2)]);
  expect(worth.get(ISBN(2))).toEqual({ used: 400, new: null });
});

test("nothing is asked twice: not the ones found, not the ones missing", async () => {
  await fillUsedOnce();
  requests = [];
  // they've since stocked vol. 3, and a week has gone by: still not asked
  stocked.add(ISBN(3));
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  expect(await usedQueue(nextWeek)).toEqual([]);
  expect(await fillUsedOnce(nextWeek)).toEqual({ asked: 0, found: 0 });
  expect(requests).toEqual([]);
});

test("a volume added to a shelf later gets its one look", async () => {
  await fillUsedOnce();
  requests = [];
  // a second series lands on the shelf
  const other = "Zzused Other Series";
  const otherIsbn = "9781999993001";
  await priceQueries.saveSeriesVolumes(volumesKey(other), [
    { ...book(1), isbn13: otherIsbn, title: `${other}, Vol. 1` },
  ]);
  forgetKnownVolumes();
  const reader = await prisma.user.findUnique({
    where: { username: "usedfiller" },
  });
  await prisma.manga.create({
    data: { userId: reader!.id, name: other, ownedList: [1], volumesOwned: 1 },
  });
  try {
    expect(await usedQueue()).toEqual([otherIsbn]);
    expect(await fillUsedOnce()).toEqual({ asked: 1, found: 0 });
    expect(requests).toEqual([[otherIsbn]]);
  } finally {
    await prisma.seriesVolumes.deleteMany({
      where: { key: volumesKey(other) },
    });
    await prisma.book.deleteMany({ where: { isbn13: otherIsbn } });
  }
});

test("off: by the switch, without Impact's keys, or outside production by default", async () => {
  config.PRICE_FILL = "off";
  expect(await fillUsedOnce()).toBe("off");
  config.PRICE_FILL = "on";
  config.IMPACT_AUTH_TOKEN = undefined;
  expect(usedFillerOn()).toBe(false);
  config.IMPACT_AUTH_TOKEN = "token";
  // the tests run as DEV
  config.PRICE_FILL = undefined;
  expect(await fillUsedOnce()).toBe("off");
  config.PRICE_FILL = "on";
  config.COLLECTOR_TOOLS = "off";
  expect(await fillUsedOnce()).toBe("off");
  expect(requests).toEqual([]);
});
