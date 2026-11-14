// Anime answers in the background (collector/animeFiller.ts), with a real
// database and a fake MangaUpdates: each known manga series is asked about
// once, most popular first, and a series that can't be asked about doesn't
// hold up the rest. MangaUpdates itself is never called: fetch is replaced.
import config from "../../config/config.js";
import {
  animeQueue,
  fillOneAnime,
  resetAnimeFiller,
} from "../../collector/animeFiller.js";
import { slugify } from "../../prices/stores/match.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

// three series: a manga, a more popular manga, and a light novel
const POPULAR = "Zzfill Popular Manga";
const OTHER = "Zzfill Other Manga";
const NOVEL = "Zzfill Story Light Novel";
const all = [POPULAR, OTHER, NOVEL];
const info = (name: string, anilistId: number, popularityRank: number) => ({
  name,
  anilistId,
  popularityRank,
  altNames: [],
  status: "RELEASING",
});

const realFetch = globalThis.fetch;
let searches: string[] = [];
let down = false;
const fakeMangaUpdates = () => {
  searches = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (!u.includes("api.mangaupdates.com"))
      throw new Error(`unexpected call: ${u}`);
    if (down) return new Response("down", { status: 503 });
    if (u.endsWith("/series/search")) {
      const { search } = JSON.parse(String(init?.body)) as { search: string };
      searches.push(search);
      return new Response(
        JSON.stringify({
          results: [{ record: { series_id: 7, title: search, type: "Manga" } }],
        }),
      );
    }
    return new Response(
      JSON.stringify({
        latest_chapter: 120,
        completed: false,
        url: "https://www.mangaupdates.com/series/test",
        anime: { start: "Vol 1, Chap 1 (S1)", end: "Vol 5, Chap 38 (S1)" },
      }),
    );
  }) as typeof fetch;
};

const saved = {
  PRICE_FILL: config.PRICE_FILL,
  COLLECTOR_TOOLS: config.COLLECTOR_TOOLS,
};
const clean = async () => {
  const slugs = all.map(slugify);
  await prisma.animeStops.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.seriesInfo.deleteMany({ where: { slug: { in: slugs } } });
};
// only this test's series: the database may hold others
const ours = async () =>
  (await animeQueue())
    .map((series) => series.name)
    .filter((name) => all.includes(name));

beforeEach(async () => {
  await emptyDb();
  await clean();
  resetAnimeFiller();
  down = false;
  Object.assign(config, { PRICE_FILL: "on", COLLECTOR_TOOLS: "on" });
  await prisma.seriesInfo.createMany({
    data: [
      { slug: slugify(OTHER), info: info(OTHER, 990001, 900002) },
      { slug: slugify(POPULAR), info: info(POPULAR, 990002, 900001) },
      { slug: slugify(NOVEL), info: info(NOVEL, 990003, 900000) },
    ],
  });
  fakeMangaUpdates();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, saved);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the queue: manga never asked about, most popular first, never a light novel", async () => {
  expect(await ours()).toEqual([POPULAR, OTHER]);
});

test("a series is asked about once and its answer is kept", async () => {
  // leave only this test's two in the queue, whatever else the database has
  const others = (await animeQueue()).filter(
    (series) => !all.includes(series.name),
  );
  await prisma.animeStops.createMany({
    data: others.map((series) => ({
      slug: slugify(series.name),
      name: series.name,
    })),
    skipDuplicates: true,
  });
  try {
    expect(await fillOneAnime()).toEqual({ asked: POPULAR });
    expect(await fillOneAnime()).toEqual({ asked: OTHER });
    expect(await fillOneAnime()).toBe("nothing");
    expect(searches).toEqual([POPULAR, OTHER]);
    const kept = await prisma.animeStops.findUnique({
      where: { slug: slugify(POPULAR) },
    });
    expect(kept).toMatchObject({
      endLine: "Vol 5, Chap 38 (S1)",
      lastChapter: 120,
    });
    expect(await ours()).toEqual([]);
  } finally {
    await prisma.animeStops.deleteMany({
      where: { slug: { in: others.map((series) => slugify(series.name)) } },
    });
  }
});

test("when MangaUpdates is down, a series waits a day and the next one gets its turn", async () => {
  down = true;
  const first = await fillOneAnime();
  const second = await fillOneAnime();
  expect(first).not.toEqual(second);
  // nothing was saved, so both still wait: but neither is asked again today
  expect(await ours()).toEqual([POPULAR, OTHER]);
});

test("off by the switch, and outside production by default", async () => {
  config.PRICE_FILL = "off";
  expect(await fillOneAnime()).toBe("off");
  // the tests run as DEV
  config.PRICE_FILL = undefined;
  expect(await fillOneAnime()).toBe("off");
  expect(searches).toEqual([]);
});
