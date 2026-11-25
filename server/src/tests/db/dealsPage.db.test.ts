// The deals page (prices/pagesService.ts getDealsPage, dealsOnShelf): a volume
// now well under its usual new price is a deal, named with its series, and
// "On my shelf" keeps the deals of series the reader has. No price search is
// made here: only prices already stored
import { dealsOnShelf, getDealsPage } from "../../prices/pagesService.js";
import { getNewPriceMedian } from "../../models/priceHistory.js";
import { EBAY_OWN_PRICES_SINCE } from "../../models/priceTables.js";
import { closeDb, prisma } from "./testDb.js";

const ON_SALE = "9781999999962";
const OTHER = "9781999999955";
const EBAY_ONLY = "9781999999948";
const BOOKS = [ON_SALE, OTHER, EBAY_ONLY];
// what's saved about each series, so nothing is asked of AniList
const SERIES = {
  "zz-deal-series": { name: "Zz Deal Series", genres: ["Comedy"] },
  "zz-other-deal-series": { name: "Zz Other Deal Series", genres: ["Horror"] },
};
const removeBooks = async () => {
  await prisma.book.deleteMany({ where: { isbn13: { in: BOOKS } } });
  await prisma.seriesInfo.deleteMany({
    where: { slug: { in: Object.keys(SERIES) } },
  });
};

beforeAll(async () => {
  await removeBooks();
  for (const [slug, info] of Object.entries(SERIES))
    await prisma.seriesInfo.create({
      data: { slug, info: { ...info, coverUrl: null } },
    });
  const now = Date.now();
  await onSale(ON_SALE, "Zz Deal Series, Vol. 1", now);
  await onSale(OTHER, "Zz Other Deal Series, Vol. 2", now);
  await ebayWithOldShipping(EBAY_ONLY, "Zz Deal Series, Vol. 3", now);
});
afterAll(async () => {
  await removeBooks();
  await closeDb();
});

const DAY_MS = 86_400_000;

// two full checks at $15 in the past weeks, and today $9 in stock: well
// under its usual price
async function onSale(isbn13: string, title: string, now: number) {
  await prisma.book.create({ data: { isbn13, title } });
  for (const days of [20, 10]) {
    await prisma.priceSample.create({
      data: {
        isbn13,
        store: "Amazon",
        priceCents: 1500,
        source: "amazon",
        fetchedAt: new Date(now - days * DAY_MS),
      },
    });
  }
  const today = new Date(now - 60_000);
  await prisma.priceSourceCheck.create({
    data: { isbn13, source: "amazon", checkedAt: today },
  });
  await prisma.priceSample.create({
    data: {
      isbn13,
      store: "Amazon",
      priceCents: 900,
      source: "amazon",
      fetchedAt: today,
    },
  });
}

// eBay alone: two prices at $16 saved before eBay's lost their shipping,
// and today $11, the book's own price
async function ebayWithOldShipping(isbn13: string, title: string, now: number) {
  await prisma.book.create({ data: { isbn13, title } });
  for (const days of [20, 10]) {
    await prisma.priceSample.create({
      data: {
        isbn13,
        store: "eBay",
        priceCents: 1600,
        source: "ebay",
        fetchedAt: new Date(EBAY_OWN_PRICES_SINCE.getTime() - days * DAY_MS),
      },
    });
  }
  const today = new Date(now - 60_000);
  await prisma.priceSourceCheck.create({
    data: { isbn13, source: "ebay", checkedAt: today },
  });
  await prisma.priceSample.create({
    data: {
      isbn13,
      store: "eBay",
      priceCents: 1100,
      source: "ebay",
      fetchedAt: today,
    },
  });
}

test("eBay prices saved with shipping don't make the usual price", async () => {
  expect(await getNewPriceMedian(EBAY_ONLY)).toBe(1100);
  const deals = await getDealsPage();
  expect(deals.map((d) => d.isbn13)).not.toContain(EBAY_ONLY);
});

test("a volume well under its usual price is a deal, with its series", async () => {
  const deal = (await getDealsPage()).find((d) => d.isbn13 === ON_SALE);
  expect(deal).toMatchObject({
    series: "Zz Deal Series",
    volume: 1,
    priceCents: 900,
    genres: ["Comedy"],
  });
});

test("on my shelf: only the deals of series the reader has", async () => {
  const mine = await dealsOnShelf([{ name: "zz deal series" }]);
  expect(mine).toContain(ON_SALE);
  expect(mine).not.toContain(OTHER);
});

test("on my shelf: the manga doesn't find its light novel", async () => {
  const mine = await dealsOnShelf([
    { name: "Zz Deal Series", lightNovel: true },
  ]);
  expect(mine).not.toContain(ON_SALE);
});
