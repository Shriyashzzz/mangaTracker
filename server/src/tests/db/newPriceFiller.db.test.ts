// New prices sooner (collector/newPriceFiller.ts), with a real database and
// a fake CJ: volumes Books-A-Million has never been asked about get one look
// each, the ones still to buy first, a daily share at a time. CJ itself is
// never called: fetch is replaced.
import config from "../../config/config.js";
import {
  fillNewPrices,
  newFillLabel,
  newPriceQueue,
} from "../../collector/newPriceFiller.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { forgetKnownVolumes } from "../../prices/service.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const SERIES = "Zznewprice Test Series";
const ISBN = (n: number) => `978199999400${n}`;
const book = (n: number) => ({
  isbn13: ISBN(n),
  title: `${SERIES}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
});

// CJ's product search, faked: Books-A-Million sells the volumes in `stocked`
// new at $9.99. Each lookup's ISBN is kept
const realFetch = globalThis.fetch;
let lookups: string[] = [];
let stocked = new Set<string>();
const fakeCj = () => {
  lookups = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes("ads.api.cj.com")) throw new Error(`unexpected call: ${u}`);
    const isbn = /\d{13}/.exec(String(init?.body ?? ""))?.[0] ?? "";
    lookups.push(isbn);
    const found = stocked.has(isbn)
      ? [
          {
            title: `${SERIES}`,
            advertiserId: "bam",
            gtin: isbn,
            price: { amount: "9.99", currency: "USD" },
            salePrice: null,
            availability: "in stock",
            link: `https://www.booksamillion.com/p/${isbn}`,
            linkCode: { clickUrl: `https://www.anrdoezrs.net/links/1/${isbn}` },
          },
        ]
      : [];
    return new Response(
      JSON.stringify({ data: { products: { resultList: found } } }),
    );
  }) as typeof fetch;
};

const saved = {
  PRICE_FILL: config.PRICE_FILL,
  COLLECTOR_TOOLS: config.COLLECTOR_TOOLS,
  BAM_FILL_DAILY: config.BAM_FILL_DAILY,
  CJ_API_TOKEN: config.CJ_API_TOKEN,
  CJ_COMPANY_ID: config.CJ_COMPANY_ID,
  CJ_BAM_ID: config.CJ_BAM_ID,
  CJ_WEBSITE_ID: config.CJ_WEBSITE_ID,
};
const clean = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: volumesKey(SERIES) } });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [1, 2, 3].map(ISBN) } },
  });
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  forgetKnownVolumes();
  Object.assign(config, {
    PRICE_FILL: "on",
    COLLECTOR_TOOLS: "on",
    BAM_FILL_DAILY: 400,
    CJ_API_TOKEN: "token",
    CJ_COMPANY_ID: "company",
    CJ_BAM_ID: "bam",
    CJ_WEBSITE_ID: "1",
  });
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    book(1),
    book(2),
    book(3),
  ]);
  // a reader who owns vol. 2: vols. 1 and 3 are theirs to buy still
  const userId = await userQueries.addUser("newprices", "a good password");
  await prisma.manga.create({
    data: { userId: userId!, name: SERIES, ownedList: [2], volumesOwned: 2 },
  });
  stocked = new Set([ISBN(1), ISBN(2)]);
  fakeCj();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, saved);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the queue: the volumes still to buy first, then the ones owned", async () => {
  expect(await newPriceQueue()).toEqual([ISBN(1), ISBN(3), ISBN(2)]);
});

test("a run looks each waiting volume up once and keeps what it finds", async () => {
  expect(await fillNewPrices()).toEqual({ asked: 3 });
  expect(lookups).toEqual([ISBN(1), ISBN(3), ISBN(2)]);
  // the two Books-A-Million sells have its new price
  for (const n of [1, 2]) {
    const offers = await priceQueries.getCurrentOffers(ISBN(n));
    expect(offers.map((o) => [o.store, o.condition, o.priceCents])).toEqual([
      ["Books-A-Million", "new", 999],
    ]);
  }
  // the price a series' total counts
  const known = await priceQueries.getKnownPrices([ISBN(1)]);
  expect(known.get(ISBN(1))?.priceCents).toBe(999);
  // the one it doesn't sell has none, and isn't asked about again
  expect(await priceQueries.getCurrentOffers(ISBN(3))).toEqual([]);
  lookups = [];
  expect(await newPriceQueue()).toEqual([]);
  expect(await fillNewPrices()).toEqual({ asked: 0 });
  expect(lookups).toEqual([]);
});

test("the day's share stops it", async () => {
  config.BAM_FILL_DAILY = 2;
  expect(await fillNewPrices()).toEqual({ asked: 2 });
  expect(await fillNewPrices()).toEqual({ asked: 0 });
  expect(lookups).toHaveLength(2);
  const [row] = await prisma.$queryRaw<{ calls: number }[]>`
    SELECT calls FROM api_usage WHERE provider = ${newFillLabel()}`;
  expect(row?.calls).toBe(2);
});

test("off: by the switch, without CJ's keys, or outside production by default", async () => {
  config.PRICE_FILL = "off";
  expect(await fillNewPrices()).toBe("off");
  config.PRICE_FILL = "on";
  config.CJ_API_TOKEN = undefined;
  expect(await fillNewPrices()).toBe("off");
  config.CJ_API_TOKEN = "token";
  // the tests run as DEV
  config.PRICE_FILL = undefined;
  expect(await fillNewPrices()).toBe("off");
  expect(lookups).toEqual([]);
});
