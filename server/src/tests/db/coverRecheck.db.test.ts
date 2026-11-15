// When Open Library is asked again about an edition it had no cover for
// (models/coversAndSitemap.ts getCoverIds): an answer the database still
// trusts comes back, one that's due again doesn't, so the cover route asks
// Open Library afresh. No cover at all is due after 20 days, Google's
// stand-in after 30, and a found cover is never due
import {
  LOW_RES_RECHECK_MS,
  NO_COVER_RECHECK_MS,
  getCoverIds,
} from "../../models/coversAndSitemap.js";
import { closeDb, prisma } from "./testDb.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const GOOGLE = "https://books.google.com/books/content?id=x&img=1";
// test ISBNs, apart from any real book's
const FOUND = "9790000000011";
const NONE = "9790000000028";
const GOOGLE_ONLY = "9790000000035";
const ALL = [FOUND, NONE, GOOGLE_ONLY];

// each edition last asked about `daysAgo` days ago
async function checkedDaysAgo(daysAgo: number) {
  const checkedAt = new Date(Date.now() - daysAgo * DAY_MS);
  const rows = [
    { isbn13: FOUND, coverId: 12345, fallbackUrl: null },
    { isbn13: NONE, coverId: null, fallbackUrl: null },
    { isbn13: GOOGLE_ONLY, coverId: null, fallbackUrl: GOOGLE },
  ];
  for (const row of rows)
    await prisma.editionCover.upsert({
      where: { isbn13: row.isbn13 },
      create: { ...row, checkedAt },
      update: { ...row, checkedAt },
    });
}
const trusted = async () =>
  (await getCoverIds(ALL)).map((row) => row.isbn13.trim()).sort();

afterAll(async () => {
  await prisma.editionCover.deleteMany({ where: { isbn13: { in: ALL } } });
  await closeDb();
});

test("the waits are 20 days for no cover and 30 for Google's", () => {
  expect(NO_COVER_RECHECK_MS).toBe(20 * DAY_MS);
  expect(LOW_RES_RECHECK_MS).toBe(30 * DAY_MS);
});

test("asked recently: every answer stands", async () => {
  await checkedDaysAgo(1);
  expect(await trusted()).toEqual([...ALL].sort());
});

test("after 20 days: no cover at all is asked about again", async () => {
  await checkedDaysAgo(21);
  expect(await trusted()).toEqual([FOUND, GOOGLE_ONLY].sort());
});

test("after 30 days: Google's stand-in is asked about again too", async () => {
  await checkedDaysAgo(31);
  // a cover Open Library has is never asked about again
  expect(await trusted()).toEqual([FOUND]);
});
