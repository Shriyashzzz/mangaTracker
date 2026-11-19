// What one reader's weekly email would say, gathered from a real database
// (src/digest/digestData.ts): their shelf's saved volume lists and edition
// lines, their To buy list's prices on file, less what they've been told.
import { digestFor } from "../../digest/digestData.js";
import { editionsKey } from "../../prices/editionSource.js";
import { volumesKey } from "../../prices/volumesKey.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const day = (offset: number) =>
  new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10);

const SINGLES = "Zzdigest Singles Manga";
const EDITION = "Zzdigest Edition Manga";
const SEEN = "Zzdigest Seen Manga";
const DROP_ISBN = "9799999990011";
const keys = [
  volumesKey(SINGLES),
  volumesKey(SEEN),
  volumesKey(EDITION),
  editionsKey(EDITION),
];

// a series whose third volume came out five days ago
const threeVolumes = (name: string, isbnStart: number) =>
  [-400, -200, -5].map((offset, i) => ({
    volume: i + 1,
    isbn13: `97999999${isbnStart + i}`.padEnd(13, "0"),
    title: `${name}, Vol. ${i + 1}`,
    published: day(offset),
  }));

async function seed(userId: number) {
  await prisma.seriesVolumes.createMany({
    data: [
      { key: volumesKey(SINGLES), volumes: threeVolumes(SINGLES, 10) },
      { key: volumesKey(SEEN), volumes: threeVolumes(SEEN, 20) },
      // VIZBIG 1 long out; VIZBIG 2 out three days ago
      {
        key: editionsKey(EDITION),
        volumes: [
          {
            key: "vizbig",
            kind: "omnibus",
            label: "VIZBIG",
            books: [
              {
                number: 1,
                volumes: [1, 2, 3],
                isbn13: "9799999990301",
                title: null,
                listed: true,
                published: day(-500),
              },
              {
                number: 2,
                volumes: [4, 5, 6],
                isbn13: "9799999990302",
                title: null,
                listed: true,
                published: day(-3),
              },
            ],
          },
        ],
      },
    ],
  });
  await prisma.manga.createMany({
    data: [
      { userId, name: SINGLES, volumesOwned: 2 },
      // collected as VIZBIG, owning its first book
      { userId, name: EDITION, volumesOwned: 3, edition: "vizbig" },
      // vol. 3 out, but they said "Seen it" to it on the site
      { userId, name: SEEN, volumesOwned: 2, seenVolume: 3 },
    ],
  });
  // on their To buy list: usually $14.99, $11.50 at Books-A-Million now
  await prisma.book.create({
    data: { isbn13: DROP_ISBN, title: "Zzdigest Drop Manga, Vol. 4" },
  });
  const old = new Date(now.getTime() - 20 * DAY);
  await prisma.priceSample.createMany({
    data: [0, 1, 2].map((i) => ({
      isbn13: DROP_ISBN,
      store: "Books-A-Million",
      source: "books-a-million",
      priceCents: 1499,
      fetchedAt: new Date(old.getTime() + i * DAY),
    })),
  });
  const lately = new Date(now.getTime() - DAY);
  await prisma.priceSample.create({
    data: {
      isbn13: DROP_ISBN,
      store: "Books-A-Million",
      source: "books-a-million",
      priceCents: 1150,
      fetchedAt: lately,
    },
  });
  await prisma.priceSourceCheck.create({
    data: { isbn13: DROP_ISBN, source: "books-a-million", checkedAt: lately },
  });
  await prisma.toBuy.create({ data: { userId, isbn13: DROP_ISBN } });
}

const clean = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: { in: keys } } });
  await prisma.book.deleteMany({ where: { isbn13: DROP_ISBN } });
};

let userId: number;
beforeEach(async () => {
  await emptyDb();
  await clean();
  userId = (await userQueries.addUser("digest", "a long password"))!;
  await seed(userId);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

const user = async () =>
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, prefs: true },
  });

test("a reader's news: a volume out, an edition's book out, a price drop", async () => {
  const digest = await digestFor(await user(), now);
  expect(digest.out.map((i) => `${i.series} ${i.book}`).sort()).toEqual([
    `${EDITION} VIZBIG 2`,
    `${SINGLES} Vol. 3`,
  ]);
  expect(digest.soon).toEqual([]);
  expect(digest.drops).toEqual([
    expect.objectContaining({
      isbn13: DROP_ISBN,
      cents: 1150,
      usualCents: 1499,
      store: "Books-A-Million",
    }),
  ]);
});

test("what they've been told already isn't told again", async () => {
  const first = await digestFor(await user(), now);
  await prisma.digestItem.createMany({
    data: [...first.out, ...first.drops].map((i) => ({
      userId,
      item: i.key,
      sentAt: now,
    })),
  });
  const again = await digestFor(await user(), now);
  expect([again.out, again.soon, again.drops]).toEqual([[], [], []]);
});

test("release checks switched off: only prices, never releases", async () => {
  await userQueries.updatePrefs(userId, { releaseChecks: "off" });
  const digest = await digestFor(await user(), now);
  expect(digest.out).toEqual([]);
  expect(digest.drops).toHaveLength(1);
});

test("a reader in Canada: Canadian prices, and none on file is no drop", async () => {
  await userQueries.updatePrefs(userId, { country: "ca" });
  const digest = await digestFor(await user(), now);
  expect(digest.drops).toEqual([]);
  expect(digest.out).toHaveLength(2);
});
