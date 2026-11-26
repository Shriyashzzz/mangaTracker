// A volume's "About this volume" (prices/volumeDetails.ts): a collector's
// list first, Google's details for what it doesn't say; details saved
// without ever erasing a value; and the slow fill's list of books to ask
// about, the pages people opened first
import {
  saveVolumeDetails,
  volumesWithoutDetails,
} from "../../models/volumeDetails.js";
import { volumeAbout } from "../../prices/volumeDetails.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { FINAL } from "../../prices/seriesCache.js";
import { closeDb, prisma } from "./testDb.js";

const A = "9781999999870";
const B = "9781999999863";
const C = "9781999999856";
const KEY = volumesKey("Zz Details Series") + FINAL;

const clean = async () => {
  await prisma.volumeDetail.deleteMany({
    where: { isbn13: { in: [A, B, C] } },
  });
  await prisma.trustedBook.deleteMany({ where: { isbn13: { in: [A, B, C] } } });
  await prisma.book.deleteMany({ where: { isbn13: { in: [A, B, C] } } });
  await prisma.seriesVolumes.deleteMany({ where: { key: KEY } });
};
beforeEach(clean);
afterAll(async () => {
  await clean();
  await closeDb();
});

test("details are filled, never erased with nothing", async () => {
  await saveVolumeDetails([
    {
      isbn13: A,
      description: "<p>First.</p>",
      pages: 192,
      published: "2020-01-14",
    },
  ]);
  await saveVolumeDetails([
    { isbn13: A, description: null, pages: null, published: "2020" },
  ]);
  expect(
    await prisma.volumeDetail.findUnique({ where: { isbn13: A } }),
  ).toMatchObject({
    description: "First.",
    pages: 192,
    published: "2020-01-14",
  });
});

test("a collector's list first, Google for what it doesn't say", async () => {
  await prisma.trustedBook.create({
    data: {
      isbn13: A,
      source: "collector-test",
      trust: 3,
      series: "Zz Details Series",
      seriesKey: "zz details series",
      kind: "single",
      volume: 1,
      title: "Zz Details Series, Vol. 1",
      pages: 200,
      listCents: 999,
    },
  });
  await saveVolumeDetails([
    {
      isbn13: A,
      description: "Google's words.",
      pages: 192,
      published: "2020-01-14",
    },
  ]);
  expect(await volumeAbout(A)).toEqual({
    published: "2020-01-14",
    pages: 200,
    description: "Google's words.",
    listCents: 999,
  });
  // nothing known: nothing to say
  expect(await volumeAbout(C)).toBeNull();
  // a book not out yet isn't "out in English": its preorder line says when
  const next = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  await saveVolumeDetails([
    {
      isbn13: B,
      description: "Soon.",
      pages: null,
      published: next.toISOString().slice(0, 10),
    },
  ]);
  expect(await volumeAbout(B)).toMatchObject({
    published: null,
    description: "Soon.",
  });
});

test("the fill asks about listed books with no details, opened pages first", async () => {
  await prisma.seriesVolumes.create({
    data: {
      key: KEY,
      volumes: [A, B, C].map((isbn13, i) => ({
        isbn13,
        title: `Zz Details Series, Vol. ${i + 1}`,
        volume: i + 1,
      })),
    },
  });
  await prisma.book.create({
    data: {
      isbn13: C,
      title: "Zz Details Series, Vol. 3",
      openedAt: new Date(),
    },
  });
  // A was asked about already (nothing found counts too)
  await saveVolumeDetails([
    { isbn13: A, description: null, pages: null, published: null },
  ]);
  const next = await volumesWithoutDetails(5000);
  expect(next).not.toContain(A);
  expect(next.indexOf(C)).toBeLessThan(next.indexOf(B));
});
