// A trusted book taking an ISBN's place (prices/trustedBooks.ts): what
// readers had on the old ISBN follows it, an old address finds the new
// volume, and a series list built by the page gets its trusted books. A
// reader who already had the new ISBN keeps theirs; a review is never lost
import {
  currentIsbn,
  loadSwaps,
  pricedIsbns,
  recordSwaps,
  trustedCatalogBook,
  withTrustedBooks,
} from "../../prices/trustedBooks.js";
import request from "supertest";
import { app } from "../../app.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const OLD = "9781999999931";
const NEW = "9781999999924";
const OTHER = "9781999999917";
const SERIES = "zz trusted series";

const clean = async () => {
  await prisma.isbnSwap.deleteMany({
    where: { fromIsbn: { in: [OLD, OTHER] } },
  });
  await prisma.trustedBook.deleteMany({ where: { seriesKey: SERIES } });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [OLD, NEW, OTHER] } },
  });
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  // what the server remembers of swaps, as the database now has them
  await loadSwaps();
});
afterAll(async () => {
  await clean();
  await closeDb();
});

const reader = (username: string) =>
  prisma.user.create({ data: { username, password: "x" } });

const swap = { from: OLD, to: NEW, volume: 1, source: "collector-test" };

test("To buy items, answers, reviews and scanned books follow the swap", async () => {
  const a = await reader("swap-a");
  const manga = await prisma.manga.create({
    data: { userId: a.id, name: "Zz Trusted Series", status: false },
  });
  await prisma.toBuy.create({
    data: { userId: a.id, isbn13: OLD, note: "gift" },
  });
  await prisma.bookVolumeAnswer.create({
    data: { userId: a.id, isbn13: OLD, volumes: [1] },
  });
  await prisma.volumeReview.create({
    data: {
      userId: a.id,
      isbn13: OLD,
      seriesSlug: "zz-trusted-series",
      volume: 1,
      rating: 5,
    },
  });
  await prisma.ownedBook.create({
    data: { mangaId: manga.id, isbn13: OLD, volumes: [1] },
  });

  await recordSwaps(SERIES, [swap]);

  expect(
    await prisma.toBuy.findMany({ where: { userId: a.id } }),
  ).toMatchObject([{ isbn13: NEW, note: "gift" }]);
  expect(
    (await prisma.bookVolumeAnswer.findMany({ where: { userId: a.id } })).map(
      (r) => r.isbn13,
    ),
  ).toEqual([NEW]);
  expect(
    (await prisma.volumeReview.findMany({ where: { userId: a.id } })).map(
      (r) => r.isbn13,
    ),
  ).toEqual([NEW]);
  expect(
    (await prisma.ownedBook.findMany({ where: { mangaId: manga.id } })).map(
      (r) => r.isbn13,
    ),
  ).toEqual([NEW]);
  expect(
    await prisma.isbnSwap.findUnique({ where: { fromIsbn: OLD } }),
  ).toMatchObject({
    toIsbn: NEW,
    seriesKey: SERIES,
  });
});

test("a reader who had both keeps the new one, and their review on the old", async () => {
  const b = await reader("swap-b");
  await prisma.toBuy.createMany({
    data: [
      { userId: b.id, isbn13: OLD },
      { userId: b.id, isbn13: NEW, note: "keep" },
    ],
  });
  await prisma.volumeReview.createMany({
    data: [
      {
        userId: b.id,
        isbn13: OLD,
        seriesSlug: "zz-trusted-series",
        volume: 1,
        rating: 4,
      },
      {
        userId: b.id,
        isbn13: NEW,
        seriesSlug: "zz-trusted-series",
        volume: 1,
        rating: 5,
      },
    ],
  });

  await recordSwaps(SERIES, [swap]);

  expect(
    await prisma.toBuy.findMany({ where: { userId: b.id } }),
  ).toMatchObject([{ isbn13: NEW, note: "keep" }]);
  // both reviews are still there
  expect(
    (await prisma.volumeReview.findMany({ where: { userId: b.id } }))
      .map((r) => r.isbn13)
      .sort(),
  ).toEqual([NEW, OLD].sort());
});

test("an old address gives the volume it is now", async () => {
  await recordSwaps(SERIES, [swap]);
  expect(currentIsbn(OLD)).toBe(NEW);
  expect(currentIsbn(OTHER)).toBe(OTHER);
  // and after the server starts again
  await loadSwaps();
  expect(currentIsbn(OLD)).toBe(NEW);
});

test("a series list gets its trusted books, and a priced ISBN stays", async () => {
  await prisma.trustedBook.createMany({
    data: [
      {
        isbn13: NEW,
        source: "collector-test",
        trust: 3,
        series: "Zz Trusted Series",
        seriesKey: SERIES,
        kind: "single",
        volume: 1,
        title: "Zz Trusted Series, Vol. 1",
        published: "2020-01-14",
      },
      {
        isbn13: OTHER,
        source: "collector-test",
        trust: 3,
        series: "Zz Trusted Series",
        seriesKey: SERIES,
        kind: "single",
        volume: 2,
        title: "Zz Trusted Series, Vol. 2",
      },
    ],
  });
  const volume = (n: number, isbn13: string) => ({
    isbn13,
    title: `Zz Trusted Series, Vol. ${n}`,
    authors: null,
    publisher: null,
    year: null,
    volume: n,
    coverUrl: "",
  });

  const unpriced = await withTrustedBooks("Zz Trusted Series", null, [
    volume(1, OLD),
  ]);
  expect(unpriced.volumes.map((v) => v.isbn13)).toEqual([NEW, OTHER]);
  expect(unpriced.swaps).toMatchObject([{ from: OLD, to: NEW }]);

  // once some store has priced the old ISBN, it's a real book and stays
  await prisma.book.create({
    data: { isbn13: OLD, title: "Zz Trusted Series, Vol. 1" },
  });
  // eBay's price doesn't prove it: its title search saves under any ISBN
  await prisma.priceSample.create({
    data: { isbn13: OLD, store: "eBay", priceCents: 999, source: "ebay" },
  });
  expect(await pricedIsbns([OLD])).toEqual(new Set());
  await prisma.priceSample.create({
    data: { isbn13: OLD, store: "Amazon", priceCents: 999, source: "amazon" },
  });
  expect(await pricedIsbns([OLD, NEW])).toEqual(new Set([OLD]));
  const priced = await withTrustedBooks("Zz Trusted Series", null, [
    volume(1, OLD),
  ]);
  expect(priced.volumes.map((v) => v.isbn13)).toEqual([OLD, OTHER]);
  expect(priced.swaps).toEqual([]);
});

test("a trusted book no catalog knows is still a book (a scan of an old one)", async () => {
  await prisma.trustedBook.create({
    data: {
      isbn13: NEW,
      source: "collector-test",
      trust: 3,
      series: "Zz Trusted Series",
      seriesKey: SERIES,
      kind: "single",
      volume: 1,
      title: "Zz Trusted Series, Vol. 1",
      publisher: "TokyoPop",
      published: "2004-08-10",
      pages: 216,
    },
  });
  expect(await trustedCatalogBook(NEW)).toMatchObject({
    isbn13: NEW,
    title: "Zz Trusted Series, Vol. 1",
    year: 2004,
    volume: 1,
    pages: 216,
  });
  expect(await trustedCatalogBook(OTHER)).toBeNull();
});

test("the API follows a swap: an old address's summary, a To buy item", async () => {
  await priceQueries.upsertBook({
    isbn13: NEW,
    title: "Zz Trusted Series, Vol. 1",
    authors: null,
    publisher: null,
    year: 2020,
    coverUrl: null,
  });
  await priceQueries.saveCheck(
    NEW,
    ["ebay"],
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
            url: null,
          },
        ],
      ],
    ]),
  );
  await recordSwaps(SERIES, [swap]);

  // the website answers the old address with a 301 to the page this names
  const summary = await request(app)
    .get(`/api/prices/summary/volume/${OLD}`)
    .expect(200);
  expect(summary.body.isbn13).toBe(NEW);

  await userQueries.addUser("swapreader", "a good password");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "swapreader", password: "a good password" })
    .expect(200);
  await agent
    .put(`/api/to-buy/${OLD}`)
    .send({})
    .expect((res) => {
      if (res.status >= 300) throw new Error(`to-buy add: ${res.status}`);
    });
  const user = await prisma.user.findFirstOrThrow({
    where: { username: "swapreader" },
  });
  expect(
    (await prisma.toBuy.findMany({ where: { userId: user.id } })).map(
      (r) => r.isbn13,
    ),
  ).toEqual([NEW]);
});
