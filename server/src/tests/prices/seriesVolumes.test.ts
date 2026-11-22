import {
  isSequelName,
  joinedNamesOf,
  novelNamesFromComic,
  volumesOfSeries,
} from "../../prices/seriesService.js";
import { pool } from "../../config/prisma.js";
import { mergeVolumes, needsGoogleShopping } from "../../prices/service.js";
import { saysComic } from "../../prices/sources/catalog.js";
import type { CatalogBook, SeriesInfo } from "../../prices/types.js";

afterAll(() => pool.end());

const book = (volume: number, isbn13 = `old-${volume}`) =>
  ({ volume, isbn13, title: `Vol. ${volume}` }) as CatalogBook;

test("a volume the catalog left out this time stays", () => {
  const merged = mergeVolumes([book(1), book(2), book(3)], [book(2, "new-2")]);
  expect(merged.map((v) => v.volume)).toEqual([1, 2, 3]);
});

test("the catalog's newest word on a volume wins, and new ones come in order", () => {
  const merged = mergeVolumes(
    [book(1), book(3)],
    [book(1, "new-1"), book(2, "new-2")],
  );
  expect(merged.map((v) => v.isbn13)).toEqual(["new-1", "new-2", "old-3"]);
});

test("nothing known and nothing found is an empty list", () => {
  expect(mergeVolumes([], [])).toEqual([]);
});

test("a volume sold on its own is never swapped for a book holding it", () => {
  const inBook = { ...book(3, "book-2"), inBook: { book: 2, from: 3, to: 4 } };
  // saved: the single vol 3; found now: only the two-volume book
  expect(mergeVolumes([book(3)], [inBook]).map((v) => v.isbn13)).toEqual([
    "old-3",
  ]);
  // the other way round, the single one takes its place
  expect(mergeVolumes([inBook], [book(3)]).map((v) => v.isbn13)).toEqual([
    "old-3",
  ]);
});

test("a listing that's really a book holding two volumes isn't a volume", () => {
  // Open Library: Vinland Saga's Book 6 is vols 11 and 12. Google Books calls
  // it "Vinland Saga 6", which reads as volume 6
  const in6 = (volume: number) => ({
    ...book(volume, "book-6"),
    inBook: { book: 6, from: 11, to: 12 },
  });
  const merged = mergeVolumes(
    [book(6, "vol-6"), in6(11), in6(12)],
    [book(6, "book-6")],
  );
  expect(merged.map((v) => [v.volume, v.isbn13])).toEqual([
    [6, "vol-6"],
    [11, "book-6"],
    [12, "book-6"],
  ]);
});

test("a known release date isn't lost to an answer without one", () => {
  const dated = { ...book(15, "frieren-15"), published: "2026-12-08" };
  const merged = mergeVolumes([dated], [book(15, "frieren-15")]);
  expect(merged[0]!.published).toBe("2026-12-08");
});

test("Google Shopping is asked only when no store found a print copy", () => {
  // eBay or Amazon found the paperback: no paid Google Shopping search
  expect(needsGoogleShopping([{ format: "print" }, { format: "ebook" }])).toBe(
    false,
  );
  // only Google Play's ebook, or nothing at all: ask it
  expect(needsGoogleShopping([{ format: "ebook" }])).toBe(true);
  expect(needsGoogleShopping([])).toBe(true);
});

test("a sequel sold as its own series isn't one of the series' other names", () => {
  // Dragon Ball Z starts again at vol. 1 in English: its vol. 17 isn't
  // Dragon Ball's
  expect(isSequelName("Dragon Ball", "Dragon Ball Z")).toBe(true);
  expect(isSequelName("Dragon Ball", "Dragonball Z")).toBe(true);
  expect(isSequelName("Dragon Ball", "Dragon Ball GT")).toBe(true);
  // the same series spelled another way, or a longer English name
  expect(isSequelName("Haikyu!!", "Haikyuu!!")).toBe(false);
  expect(isSequelName("Dragon Ball", "Dragonball")).toBe(false);
  expect(isSequelName("Frieren", "Frieren: Beyond Journey's End")).toBe(false);
  expect(isSequelName("Kimetsu no Yaiba", "Demon Slayer")).toBe(false);
});

// ---------- a title carrying both of a series' names ----------
const MDZS = "Grandmaster of Demonic Cultivation";
const found = (title: string, volume: number, pages = 400) =>
  ({ title, volume, isbn13: `97800000000${volume}0`, pages }) as CatalogBook;
// as the catalog hands them on: a novel's under "… Light Novel", a comic's
// as its publisher wrote it
const novels = [1, 2, 3].map((n) =>
  found(`${MDZS}: Mo Dao Zu Shi Light Novel, Vol. ${n}`, n),
);
const comics = [1, 2].map((n) =>
  found(`${MDZS}: Mo Dao Zu Shi (The Comic / Manhua) Vol. ${n}`, n, 300),
);
const info = (name: string, altNames: string[]) =>
  ({ name, altNames }) as SeriesInfo;

test("a series sold under both its names at once is found under its own", () => {
  const novel = `${MDZS} Light Novel`;
  const novelInfo = info(novel, ["Mo Dao Zu Shi Light Novel"]);
  expect(joinedNamesOf(novel, novelInfo)).toEqual([
    `${MDZS}: Mo Dao Zu Shi Light Novel`,
  ]);
  expect(joinedNamesOf(MDZS, info(MDZS, ["Mo Dao Zu Shi"]))).toEqual([
    `${MDZS}: Mo Dao Zu Shi`,
  ]);
  const every = [...novels, ...comics];
  // without the joined name, none of them reads as this series
  expect(volumesOfSeries(every, novel, true)).toEqual([]);
  // with it: the novel's page gets the novels, numbered and named as its own
  const onNovel = volumesOfSeries(
    every,
    novel,
    true,
    joinedNamesOf(novel, novelInfo),
  );
  expect(onNovel.map((v) => v.title)).toEqual(
    [1, 2, 3].map((n) => `${novel}, Vol. ${n}`),
  );
  // and the comic's page gets the comics, never the novels
  const onComic = volumesOfSeries(
    every,
    MDZS,
    true,
    joinedNamesOf(MDZS, info(MDZS, ["Mo Dao Zu Shi"])),
  );
  expect(onComic.map((v) => v.title)).toEqual(
    [1, 2].map((n) => `${MDZS}, Vol. ${n}`),
  );
});

test("a sequel with its own numbers is never taken for the series", () => {
  // "Year 2" isn't one of the series' names: its volume 1 stays out
  const name = "Classroom of the Elite Light Novel";
  const books = [
    found("Classroom of the Elite: Year 2 Light Novel, Vol. 1", 1),
  ];
  const names = joinedNamesOf(
    name,
    info(name, ["Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e Light Novel"]),
  );
  expect(volumesOfSeries(books, name, true, names)).toEqual([]);
  // nothing known of its other names: nothing joined
  expect(joinedNamesOf(name, null)).toEqual([]);
  expect(joinedNamesOf(name, info(name, []))).toEqual([]);
});

test("a comic that says so among other words is a comic, never the novel", () => {
  for (const title of [
    `${MDZS}: Mo Dao Zu Shi (The Comic / Manhua) Vol. 6`,
    "Heaven Official's Blessing (The Comic): Volume 2",
    "Solo Leveling, Vol. 5 (comic)",
    "Overlord, Vol. 3 (manga)",
  ])
    expect(saysComic(title)).toBe(true);
  for (const title of [
    `${MDZS}: Mo Dao Zu Shi (Novel) Vol. 1`,
    "Overlord, Vol. 3 (light novel): The Bloody Valkyrie",
    "Comic Girls, Vol. 1",
  ])
    expect(saysComic(title)).toBe(false);
});

test("a novel AniList doesn't list is looked for under its comic's names", () => {
  const comic = info(`${MDZS}: Mo Dao Zu Shi`, ["Modao Zushi"]);
  expect(novelNamesFromComic(`${MDZS} Light Novel`, comic)).toMatchObject({
    name: `${MDZS}: Mo Dao Zu Shi Light Novel`,
    altNames: ["Modao Zushi Light Novel"],
  });
  // AniList's loose guess at another series is never used
  expect(
    novelNamesFromComic("Blue Light Novel", info("Blue Lock", ["Blue Lock"])),
  ).toBeNull();
  // nor for a manga, or with no comic known
  expect(novelNamesFromComic(MDZS, comic)).toBeNull();
  expect(novelNamesFromComic(`${MDZS} Light Novel`, null)).toBeNull();
});
