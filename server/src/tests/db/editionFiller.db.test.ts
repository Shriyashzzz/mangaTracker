// Edition lines in the background (collector/editionFiller.ts), with a real
// database and fake catalogs: each known manga series whose lines are missing
// or old is asked about, most popular first, and a fresh one is left alone.
// Neither Open Library nor Google Books is really called: fetch is replaced.
import config from "../../config/config.js";
import {
  editionQueue,
  fillOneEdition,
  resetEditionFiller,
} from "../../collector/editionFiller.js";
import { editionsKey } from "../../prices/editionSource.js";
import { slugify } from "../../prices/stores/match.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const POPULAR = "Zzedfill Popular Manga";
const OTHER = "Zzedfill Other Manga";
const NOVEL = "Zzedfill Story Light Novel";
const all = [POPULAR, OTHER, NOVEL];
const info = (name: string, anilistId: number, popularityRank: number) => ({
  name,
  anilistId,
  popularityRank,
  altNames: [],
  status: "RELEASING",
});

const realFetch = globalThis.fetch;
let asked: string[] = [];
// Open Library answers with two omnibus books of whatever was searched for;
// Google has nothing to add
const fakeCatalogs = () => {
  asked = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = new URL(String(url));
    if (u.hostname === "openlibrary.org") {
      const name = /title:"([^"]+)"/.exec(u.searchParams.get("q") ?? "")?.[1];
      asked.push(name ?? "?");
      const docs = [1, 2].map((n) => ({
        title: `${name} Omnibus, Vol. ${n}`,
        isbn: [`978142150000${n}`],
        publisher: ["A Publisher"],
        // as long as three volumes: an omnibus
        number_of_pages_median: 600,
      }));
      return new Response(JSON.stringify({ docs }));
    }
    if (u.hostname === "www.googleapis.com")
      return new Response(JSON.stringify({ items: [] }));
    // Books-A-Million's shelf (through CJ): nothing to add either
    if (u.hostname === "ads.api.cj.com")
      return new Response(
        JSON.stringify({ data: { products: { resultList: [] } } }),
      );
    throw new Error(`unexpected call: ${u}`);
  }) as typeof fetch;
};

const saved = { PRICE_FILL: config.PRICE_FILL };
const keys = all.map((name) => editionsKey(name));
const clean = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: { in: keys } } });
  await prisma.seriesInfo.deleteMany({
    where: { slug: { in: all.map(slugify) } },
  });
};
// only this test's series: the database may hold others
const ours = async () =>
  (await editionQueue())
    .map((series) => series.name)
    .filter((name) => all.includes(name));
const linesOf = async (name: string) =>
  (await prisma.seriesVolumes.findUnique({ where: { key: editionsKey(name) } }))
    ?.volumes as { label: string; books: unknown[] }[] | undefined;

beforeEach(async () => {
  await emptyDb();
  await clean();
  resetEditionFiller();
  Object.assign(config, { PRICE_FILL: "on" });
  await prisma.seriesInfo.createMany({
    data: [
      { slug: slugify(OTHER), info: info(OTHER, 990101, 900002) },
      { slug: slugify(POPULAR), info: info(POPULAR, 990102, 900001) },
      { slug: slugify(NOVEL), info: info(NOVEL, 990103, 900000) },
    ],
  });
  fakeCatalogs();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(config, saved);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the queue: manga with no lines saved, most popular first, never a light novel", async () => {
  expect(await ours()).toEqual([POPULAR, OTHER]);
});

test("a series with fresh lines is left alone; old ones are asked about again", async () => {
  await prisma.seriesVolumes.create({
    data: { key: editionsKey(POPULAR), volumes: [] },
  });
  expect(await ours()).toEqual([OTHER]);
  // saved over a week ago
  await prisma.seriesVolumes.update({
    where: { key: editionsKey(POPULAR) },
    data: { fetchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
  });
  expect(await ours()).toEqual([POPULAR, OTHER]);
});

test("a run looks one series up and saves its lines", async () => {
  // leave only this test's two in the queue, whatever else the database has
  const others = (await editionQueue()).filter(
    (series) => !all.includes(series.name),
  );
  await prisma.seriesVolumes.createMany({
    data: others.map((series) => ({
      key: editionsKey(series.name),
      volumes: [],
    })),
    skipDuplicates: true,
  });
  try {
    expect(await fillOneEdition()).toEqual({ asked: POPULAR });
    expect(asked).toEqual([POPULAR]);
    const lines = await linesOf(POPULAR);
    expect(lines?.map((line) => line.label)).toEqual(["Omnibus"]);
    expect(lines?.[0]?.books).toHaveLength(2);
    // the next run goes on to the next series
    expect(await fillOneEdition()).toEqual({ asked: OTHER });
    expect(await fillOneEdition()).toBe("nothing");
  } finally {
    await prisma.seriesVolumes.deleteMany({
      where: { key: { in: others.map((s) => editionsKey(s.name)) } },
    });
  }
});

test("switched off, it does nothing", async () => {
  Object.assign(config, { PRICE_FILL: "off" });
  expect(await fillOneEdition()).toBe("off");
  expect(asked).toEqual([]);
});
