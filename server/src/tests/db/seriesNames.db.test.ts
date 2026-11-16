// The known series names (prices/seriesNames.ts) with a real database: a
// typo AniList can't answer finds the names it's a slip or two from. Names
// of its own (Zz…), so no other test's series are touched
import {
  forgetSeriesNames,
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
