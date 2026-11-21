// What an "after the anime" page says about buying, read from a real
// database: each English volume that's out, with its cheapest saved new
// price at a store readers know (prices/afterAnime/savedBooks.ts). No store
// or catalog is called.
import priceQueries from "../../models/priceQueries.js";
import { savedBooksOf } from "../../prices/afterAnime/savedBooks.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { finalKey } from "../../prices/seriesCache.js";
import { closeDb, prisma } from "./testDb.js";

const SERIES = "Zzafter Anime Series";
const ISBN = (n: number) => `978199999600${n}`;

const offer = (condition: string, priceCents: number, store: string) => ({
  store,
  format: "print",
  condition,
  priceCents,
  currency: "USD",
  inStock: true,
  url: `https://example.com/${priceCents}`,
});

const listed = (n: number, published?: string) => ({
  isbn13: ISBN(n),
  title: `${SERIES}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
  ...(published ? { published } : {}),
});

const clean = async () => {
  await prisma.seriesVolumes.deleteMany({
    where: { key: { in: [volumesKey(SERIES), finalKey(SERIES)] } },
  });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [1, 2, 3, 4].map(ISBN) } },
  });
};

beforeEach(clean);
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the volumes that are out, each with its cheapest saved new price", async () => {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    listed(1),
    listed(2),
    listed(3),
    // not out yet: nothing to catch up on
    listed(4, nextYear.toISOString().slice(0, 10)),
  ]);
  for (const n of [1, 2, 3])
    await priceQueries.upsertBook({
      isbn13: ISBN(n),
      title: `${SERIES}, Vol. ${n}`,
      authors: null,
      publisher: null,
      year: 2020,
      coverUrl: null,
    });
  // volume 1: a new copy and a cheaper used one; volume 2: used only
  await priceQueries.saveCheck(
    ISBN(1),
    ["ebay"],
    new Map([
      ["ebay", [offer("new", 1099, "eBay"), offer("used", 500, "eBay")]],
    ]),
  );
  await priceQueries.saveCheck(
    ISBN(2),
    ["ebay"],
    new Map([["ebay", [offer("used", 600, "eBay")]]]),
  );

  const books = await savedBooksOf(SERIES);

  expect(books.map((b) => [b.volume, b.cents, b.store])).toEqual([
    [1, 1099, "eBay"],
    // a used copy is never said as the new price
    [2, null, null],
    [3, null, null],
  ]);
  expect(books[0]!.checkedAt).toBeInstanceOf(Date);
});

test("the series page's list wins over the raw catalog list, which can miss a volume", async () => {
  // the raw list missed vol. 2; the series page's merged list has it
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    listed(1),
    listed(3),
  ]);
  await priceQueries.saveSeriesVolumes(finalKey(SERIES), [
    listed(1),
    listed(2),
    listed(3),
  ]);
  const books = await savedBooksOf(SERIES);
  expect(books.map((b) => b.volume)).toEqual([1, 2, 3]);
});

test("a series with no saved list has nothing to say", async () => {
  expect(await savedBooksOf("Zzafter Nothing Saved")).toEqual([]);
});
