// The deals page (prices/pagesService.ts getDealsPage, dealsOnShelf): a volume
// now well under its usual new price is a deal, named with its series, and
// "On my shelf" keeps the deals of series the reader has. No price search is
// made here: only prices already stored
import { dealsOnShelf, getDealsPage } from "../../prices/pagesService.js";
import { closeDb, prisma } from "./testDb.js";

const ON_SALE = "9781999999962";
const OTHER = "9781999999955";
const BOOKS = [ON_SALE, OTHER];
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
