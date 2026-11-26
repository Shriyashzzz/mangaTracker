// Readers' books as a trusted source (prices/readerBooks.ts): three
// week-old accounts agreeing on an ISBN's series and volume, one of them by
// a scan, with the book still on their shelves, make it a trusted book;
// fewer, newer accounts, imports alone, undone scans or a disagreement
// don't, and a collector's list is never replaced
import {
  noteReaderBooks,
  promoteAgreed,
  promotePending,
  READERS_SOURCE,
} from "../../prices/readerBooks.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const ISBN = "9781999999900";
const SERIES = { name: "Zz Reader Series", lightNovel: false };
const WEEKS_AGO = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
const vol3 = [{ isbn13: ISBN, edition: "single", volumes: [3] }];

const clean = () => prisma.trustedBook.deleteMany({ where: { isbn13: ISBN } });

beforeEach(async () => {
  await emptyDb();
  await clean();
});
afterAll(async () => {
  await clean();
  await closeDb();
});

// a reader whose account is `old` (three weeks) or new today
const reader = (username: string, old = true) =>
  prisma.user.create({
    data: { username, password: "x", ...(old ? { createdAt: WEEKS_AGO } : {}) },
  });

type Seen = { isbn13: string | null; edition: string; volumes: number[] };

// a reader's books on their shelf, as a scan or an import leaves them: the
// series with those volumes owned, and the books
async function shelve(userId: number, books: Seen[]) {
  const volumes = [...new Set(books.flatMap((b) => b.volumes))];
  const manga = await prisma.manga.create({
    data: {
      userId,
      name: SERIES.name,
      status: false,
      ownedList: volumes,
      volumesOwned: Math.max(...volumes),
    },
  });
  await prisma.ownedBook.createMany({
    data: books.map((b) => ({ mangaId: manga.id, ...b })),
  });
  return manga;
}

// a reader scanning or importing books onto their shelf
async function seen(userId: number, books: Seen[], how: "scan" | "import") {
  await shelve(userId, books);
  await noteReaderBooks(userId, SERIES, books, how);
}

const trusted = () =>
  prisma.trustedBook.findUnique({ where: { isbn13: ISBN } });

test("three readers, one of them scanning, make it a trusted book", async () => {
  const [a, b, c] = await Promise.all([
    reader("ra"),
    reader("rb"),
    reader("rc"),
  ]);
  await seen(a.id, vol3, "import");
  await seen(b.id, vol3, "import");
  expect(await trusted()).toBeNull();
  await seen(c.id, vol3, "scan");
  expect(await trusted()).toMatchObject({
    source: READERS_SOURCE,
    trust: 2,
    seriesKey: "zz reader series",
    kind: "single",
    volume: 3,
    title: "Zz Reader Series, Vol. 3",
  });
});

test("imports alone never do it: a file's ISBN can be an ebook's", async () => {
  const readers = await Promise.all(
    ["ia", "ib", "ic", "id"].map((n) => reader(n)),
  );
  for (const r of readers) await seen(r.id, vol3, "import");
  expect(await trusted()).toBeNull();
});

test("new accounts don't count yet, and only once they're a week old", async () => {
  const [a, b] = await Promise.all([reader("na"), reader("nb")]);
  const c = await reader("nc", false);
  for (const r of [a, b]) await seen(r.id, vol3, "scan");
  await seen(c.id, vol3, "scan");
  expect(await trusted()).toBeNull();
  // a week and more later, the same three agree
  const later = Date.now() + 8 * 24 * 60 * 60 * 1000;
  expect(await promoteAgreed([ISBN], later)).toBe(1);
  expect(await trusted()).not.toBeNull();
});

test("readers who disagree on the volume don't add up", async () => {
  const [a, b, c] = await Promise.all([
    reader("da"),
    reader("db"),
    reader("dc"),
  ]);
  await seen(a.id, vol3, "scan");
  await seen(b.id, vol3, "scan");
  await seen(c.id, [{ isbn13: ISBN, edition: "single", volumes: [4] }], "scan");
  expect(await trusted()).toBeNull();
});

test("edition books and books holding several volumes aren't sightings", async () => {
  const a = await reader("ea");
  await seen(
    a.id,
    [
      { isbn13: ISBN, edition: "omnibus", volumes: [1, 2, 3] },
      { isbn13: "9781999999917", edition: "single", volumes: [1, 2] },
      { isbn13: null, edition: "single", volumes: [5] },
    ],
    "scan",
  );
  expect(await prisma.isbnSighting.count({ where: { userId: a.id } })).toBe(0);
});

test("a collector's list is never replaced by readers", async () => {
  await prisma.trustedBook.create({
    data: {
      isbn13: ISBN,
      source: "collector-test",
      trust: 3,
      series: "Zz Reader Series",
      seriesKey: "zz reader series",
      kind: "single",
      volume: 3,
      title: "Zz Reader Series, Vol. 3",
    },
  });
  const readers = await Promise.all(["ca", "cb", "cc"].map((n) => reader(n)));
  for (const r of readers) await seen(r.id, vol3, "scan");
  expect(await trusted()).toMatchObject({ source: "collector-test", trust: 3 });
});

test("the daily pass promotes what's agreed on and not trusted yet", async () => {
  const readers = await Promise.all(["pa", "pb", "pc"].map((n) => reader(n)));
  for (const r of readers) {
    await shelve(r.id, vol3);
    await prisma.isbnSighting.create({
      data: {
        userId: r.id,
        isbn13: ISBN,
        seriesKey: "zz reader series",
        series: "Zz Reader Series",
        kind: "single",
        volume: 3,
        how: "scan",
      },
    });
  }
  expect(await promotePending()).toBe(1);
  expect(await trusted()).toMatchObject({ volume: 3, trust: 2 });
  // done once: nothing left to promote
  expect(await promotePending()).toBe(0);
});

test("a scan undone takes its word back", async () => {
  const readers = await Promise.all(["ua", "ub", "uc"].map((n) => reader(n)));
  for (const r of readers.slice(0, 2)) await seen(r.id, vol3, "scan");
  // the third scans it, then undoes it: the volume isn't owned any more
  const third = await shelve(readers[2]!.id, vol3);
  await prisma.manga.update({
    where: { id: third.id },
    data: { ownedList: [], volumesOwned: null },
  });
  await noteReaderBooks(readers[2]!.id, SERIES, vol3, "scan");
  expect(await trusted()).toBeNull();
});
