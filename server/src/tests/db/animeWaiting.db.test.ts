// An anime that's still airing has no last chapter yet, so MangaUpdates'
// "nothing known" for it is not kept in the database (afterAnime/
// animeSource.ts): it would stand for a month, past the anime's end. With a
// real database and a fake MangaUpdates, which is never really called.
import {
  animeLinesFor,
  forgetWaiting,
} from "../../prices/afterAnime/animeSource.js";
import { slugify } from "../../prices/stores/match.js";
import type { AnimeState } from "../../prices/types.js";
import { closeDb, prisma } from "./testDb.js";

const AIRING = "Zzwait Airing Series";
const NO_ANIME = "Zzwait No Anime Series";
const names = [AIRING, NO_ANIME];
const airing: AnimeState = { state: "airing", episodes: 12 };
const none: AnimeState = { state: "none", episodes: null };

const realFetch = globalThis.fetch;
let asked = 0;
// what MangaUpdates says of the anime: nothing, until the test fills it in
let lines: { start: string | null; end: string | null } = {
  start: null,
  end: null,
};
const fakeMangaUpdates = () => {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes("api.mangaupdates.com"))
      throw new Error(`unexpected call: ${u}`);
    if (u.endsWith("/series/search")) {
      const { search } = JSON.parse(String(init?.body)) as { search: string };
      return new Response(
        JSON.stringify({
          results: [{ record: { series_id: 7, title: search, type: "Manga" } }],
        }),
      );
    }
    asked++;
    return new Response(
      JSON.stringify({
        latest_chapter: 120,
        completed: false,
        url: "https://www.mangaupdates.com/series/test",
        anime: lines,
      }),
    );
  }) as typeof fetch;
};

const clean = () =>
  prisma.animeStops.deleteMany({
    where: { slug: { in: names.map((name) => slugify(name)) } },
  });
const savedRow = (name: string) =>
  prisma.animeStops.findUnique({ where: { slug: slugify(name) } });

beforeEach(async () => {
  await clean();
  forgetWaiting();
  asked = 0;
  lines = { start: null, end: null };
  fakeMangaUpdates();
});
afterAll(async () => {
  globalThis.fetch = realFetch;
  await clean();
  await closeDb();
});

test("nothing known for an anime still airing is not saved", async () => {
  const answer = await animeLinesFor({ name: AIRING, anime: airing }, true);
  expect(answer).toBeNull();
  expect(await savedRow(AIRING)).toBeNull();
  expect(asked).toBe(1);

  // opened again straight away: MangaUpdates isn't asked every time
  await animeLinesFor({ name: AIRING, anime: airing }, true);
  expect(asked).toBe(1);
});

test("once the anime ends and its stop is recorded, it is found and saved", async () => {
  await animeLinesFor({ name: AIRING, anime: airing }, true);
  // a while later
  forgetWaiting();
  lines = { start: "Vol 1, Chap 1 (S1)", end: "Vol 4, Chap 30 (S1)" };

  const answer = await animeLinesFor({ name: AIRING, anime: airing }, true);
  expect(answer?.endLine).toBe("Vol 4, Chap 30 (S1)");
  expect((await savedRow(AIRING))?.endLine).toBe("Vol 4, Chap 30 (S1)");
});

test("an empty answer saved before the anime was known to be airing goes", async () => {
  await prisma.animeStops.create({
    data: { slug: slugify(AIRING), name: AIRING },
  });
  // the saved row is fresh, but it's asked about anyway
  await animeLinesFor({ name: AIRING, anime: airing }, true);
  expect(asked).toBe(1);
  expect(await savedRow(AIRING)).toBeNull();
});

test("a series with no anime keeps its empty answer, as before", async () => {
  await animeLinesFor({ name: NO_ANIME, anime: none }, true);
  expect(await savedRow(NO_ANIME)).not.toBeNull();
  // and isn't asked about again for a month
  await animeLinesFor({ name: NO_ANIME, anime: none }, true);
  expect(asked).toBe(1);
});
