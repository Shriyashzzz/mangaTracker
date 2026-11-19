// Edition lines built while a catalog wasn't answering (prices/editionSource.ts):
// saved, so the shelf shows them too, with a marker to ask again in an hour;
// never put over a whole answer saved before. With a real database and fake
// catalogs: Open Library is the one that's down.
import config from "../../config/config.js";
import {
  editionLinesOf,
  editionsKey,
  halfAnswerKey,
} from "../../prices/editionSource.js";
import { editionQueue } from "../../collector/editionFiller.js";
import { slugify } from "../../prices/stores/match.js";
import { closeDb, prisma } from "./testDb.js";

const NAME = "Zzhalf Answer Manga";
const HOUR = 60 * 60 * 1000;
const realFetch = globalThis.fetch;
const savedConfig = { GOOGLE_BOOKS_API_KEY: config.GOOGLE_BOOKS_API_KEY };

let openLibraryUp = false;
let calls = 0;
// Google: two omnibus books. Open Library: down, or one more book
function fakeCatalogs() {
  globalThis.fetch = (async (url: string | URL) => {
    const u = new URL(String(url));
    calls++;
    if (u.hostname === "openlibrary.org") {
      if (!openLibraryUp) return new Response("down", { status: 500 });
      const docs = [1, 2, 3].map((n) => ({
        title: `${NAME} Omnibus, Vol. ${n}`,
        isbn: [`978142159990${n}`],
        publisher: ["VIZ Media"],
        number_of_pages_median: 600,
      }));
      return new Response(JSON.stringify({ docs }));
    }
    if (u.hostname === "www.googleapis.com") {
      const items = [1, 2].map((n) => ({
        volumeInfo: {
          title: `${NAME} Omnibus, Vol. ${n}`,
          language: "en",
          publisher: "VIZ Media",
          pageCount: 600,
          industryIdentifiers: [
            { type: "ISBN_13", identifier: `978142159990${n}` },
          ],
        },
      }));
      return new Response(JSON.stringify({ items }));
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}

const clean = () =>
  prisma.seriesVolumes.deleteMany({
    where: { key: { in: [editionsKey(NAME), halfAnswerKey(NAME)] } },
  });
const saved = (key: string) =>
  prisma.seriesVolumes.findUnique({ where: { key } });
const age = (key: string, ms: number) =>
  prisma.seriesVolumes.update({
    where: { key },
    data: { fetchedAt: new Date(Date.now() - ms) },
  });
const booksIn = (lines: { books: unknown[] }[]) =>
  lines.reduce((n, line) => n + line.books.length, 0);

beforeEach(async () => {
  await clean();
  openLibraryUp = false;
  calls = 0;
  // a key, so Google is one of the catalogs asked
  Object.assign(config, { GOOGLE_BOOKS_API_KEY: "test-key" });
  fakeCatalogs();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, savedConfig);
});
afterAll(async () => {
  await clean();
  await prisma.seriesInfo.deleteMany({ where: { slug: slugify(NAME) } });
  await closeDb();
});

test("a half answer is saved, so the shelf has it too, and marked", async () => {
  const lines = await editionLinesOf(NAME, []);
  expect(booksIn(lines)).toBe(2);
  expect(await saved(editionsKey(NAME))).not.toBeNull();
  expect(await saved(halfAnswerKey(NAME))).not.toBeNull();
  // within the hour: what's saved, nothing asked
  calls = 0;
  expect(booksIn(await editionLinesOf(NAME, []))).toBe(2);
  expect(calls).toBe(0);
});

test("an hour on it's asked again, and a whole answer clears the marker", async () => {
  await editionLinesOf(NAME, []);
  await age(halfAnswerKey(NAME), HOUR + 60_000);
  openLibraryUp = true;
  const lines = await editionLinesOf(NAME, []);
  expect(booksIn(lines)).toBe(3);
  expect(await saved(halfAnswerKey(NAME))).toBeNull();
  // now a whole answer: fresh for the week, nothing asked
  calls = 0;
  await editionLinesOf(NAME, []);
  expect(calls).toBe(0);
});

test("a whole answer saved before is never replaced by a half one", async () => {
  openLibraryUp = true;
  await editionLinesOf(NAME, []);
  // a week and more on, and Open Library down this time
  await age(editionsKey(NAME), 8 * 24 * HOUR);
  openLibraryUp = false;
  const lines = await editionLinesOf(NAME, []);
  expect(booksIn(lines)).toBe(3);
  const kept = (await saved(editionsKey(NAME)))?.volumes as {
    books: unknown[];
  }[];
  expect(booksIn(kept)).toBe(3);
  // and it's asked about again in an hour
  expect(await saved(halfAnswerKey(NAME))).not.toBeNull();
  // an hour on, still down: the whole answer is still kept
  await age(halfAnswerKey(NAME), HOUR + 60_000);
  expect(booksIn(await editionLinesOf(NAME, []))).toBe(3);
  const still = (await saved(editionsKey(NAME)))?.volumes as {
    books: unknown[];
  }[];
  expect(booksIn(still)).toBe(3);
});

test("the daily job picks up a half answer an hour on", async () => {
  await prisma.seriesInfo.upsert({
    where: { slug: slugify(NAME) },
    update: {},
    create: {
      slug: slugify(NAME),
      info: { name: NAME, anilistId: 990199, popularityRank: 900009 },
    },
  });
  await editionLinesOf(NAME, []);
  const waiting = async () =>
    (await editionQueue()).some((series) => series.name === NAME);
  expect(await waiting()).toBe(false);
  await age(halfAnswerKey(NAME), HOUR + 60_000);
  expect(await waiting()).toBe(true);
});
