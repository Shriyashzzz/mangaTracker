// The known series names (prices/seriesNames.ts) with a real database: a
// typo AniList can't answer finds the names it's a slip or two from. Names
// of its own (Zz…), so no other test's series are touched
import {
  forgetSeriesNames,
  knownSeriesHits,
  nearSeriesNames,
} from "../../prices/seriesNames.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const NAMES = [
  "Zzchainsaw Mann",
  "Zzchainsaw Mann: Buddy Stories",
  "Zzone Pieced",
  "Zzlater",
];
const slugOf = (name: string) => name.toLowerCase().replace(/\W+/g, "-");
const SLUGS = [...NAMES.map(slugOf), "zz-nothing"];

// series_info isn't a shelf table: these tests clear their own rows
const clean = () =>
  prisma.seriesInfo.deleteMany({ where: { slug: { in: SLUGS } } });

beforeEach(async () => {
  await emptyDb();
  await clean();
  for (const name of NAMES.slice(0, 3))
    await prisma.seriesInfo.create({
      data: { slug: slugOf(name), info: { name } },
    });
  // a lookup that found nothing has no name
  await prisma.seriesInfo.create({ data: { slug: "zz-nothing" } });
  forgetSeriesNames();
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("a typo finds the known names it's near, closest first", async () => {
  expect(await nearSeriesNames("zzchainsw mann")).toEqual([
    "Zzchainsaw Mann",
    "Zzchainsaw Mann: Buddy Stories",
  ]);
  expect(await nearSeriesNames("zzone peiced")).toEqual(["Zzone Pieced"]);
  expect(await nearSeriesNames("qqxxzz nothing")).toEqual([]);
});

test("the list is read once and kept, until it's an hour old", async () => {
  await nearSeriesNames("zzone pieced");
  await prisma.seriesInfo.create({
    data: { slug: slugOf("Zzlater"), info: { name: "Zzlater" } },
  });
  // still the list read a moment ago
  expect(await nearSeriesNames("zzlatter")).toEqual([]);
  forgetSeriesNames();
  expect(await nearSeriesNames("zzlatter")).toEqual(["Zzlater"]);
});

test("a search answered from the known series: by name, other names or a slip", async () => {
  await prisma.seriesInfo.update({
    where: { slug: slugOf("Zzchainsaw Mann") },
    data: {
      info: {
        name: "Zzchainsaw Mann",
        altNames: ["Zzchensoo Man"],
        coverUrl: "https://example.com/c.jpg",
        score: 85,
        volumes: 22,
        status: "RELEASING",
        popularityRank: 3,
      },
    },
  });
  forgetSeriesNames();
  const found = await knownSeriesHits("zzchainsaw");
  // the most popular first, shaped as the search's own answers
  expect(found[0]).toMatchObject({
    name: "Zzchainsaw Mann",
    slug: "zzchainsaw-mann",
    coverUrl: "https://example.com/c.jpg",
    score: 85,
  });
  expect(found.map((s) => s.name)).toEqual([
    "Zzchainsaw Mann",
    "Zzchainsaw Mann: Buddy Stories",
  ]);
  // another name, and a slip of the finger
  expect((await knownSeriesHits("zzchensoo"))[0]?.name).toBe("Zzchainsaw Mann");
  expect((await knownSeriesHits("zzone peiced"))[0]?.name).toBe("Zzone Pieced");
  expect(await knownSeriesHits("qqxx nothing")).toEqual([]);
});
