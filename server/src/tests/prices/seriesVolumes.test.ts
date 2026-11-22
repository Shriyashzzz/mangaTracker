import {
  isSequelName,
  joinedNamesOf,
  novelNamesFromComic,
  publisherCheck,
  volumesOfSeries,
} from "../../prices/seriesService.js";
import { pool } from "../../config/prisma.js";
import { mergeVolumes, needsGoogleShopping } from "../../prices/service.js";
import {
  isbnsToListUnder,
  isbnToListUnder,
  saysComic,
} from "../../prices/sources/catalog.js";
import { seriesOf } from "../../prices/stores/match.js";
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

// ---------- the odd one out by publisher ----------
// a volume under a publisher's ISBN start: 978 1 4215 is VIZ's
const under = (start: string, volume: number) => ({
  volume,
  isbn13: `${start}${String(100000 + volume).slice(1)}0`,
});
const viz = (volume: number) => under("9781421", volume);

test("a volume whose ISBN starts like no other is another publisher's", () => {
  // Hunter x Hunter as the catalogs had it: 13 a print-on-demand copy, 14 a
  // library rebind, 27 another book altogether
  const volumes = Array.from({ length: 30 }, (_, i) => viz(i + 1));
  volumes[12] = under("9798897", 13);
  volumes[13] = under("9781435", 14);
  volumes[26] = under("9780451", 27);
  const check = publisherCheck(volumes);
  expect([...check.odd].sort()).toEqual(
    [volumes[12]!, volumes[13]!, volumes[26]!].map((v) => v.isbn13).sort(),
  );
  // only the publisher's own edition may take an odd one's place
  expect(check.fits(viz(27).isbn13)).toBe(true);
  expect(check.fits(under("9780451", 27).isbn13)).toBe(false);
});

test("a publisher's change of ISBNs is never taken for an odd one out", () => {
  // the newest volume alone under a new start: the first of the new run
  const newRun = [
    ...Array.from({ length: 12 }, (_, i) => viz(i + 1)),
    under("9781974", 13),
  ];
  expect(publisherCheck(newRun).odd.size).toBe(0);
  // two starts, each with volumes of its own
  const both = Array.from({ length: 20 }, (_, i) =>
    i < 10 ? viz(i + 1) : under("9781974", i + 1),
  );
  expect(publisherCheck(both).odd.size).toBe(0);
});

test("with no clear publisher, nothing is called odd and anything fits", () => {
  // a short series
  const short = [viz(1), viz(2), under("9780451", 3)];
  expect(publisherCheck(short).odd.size).toBe(0);
  expect(publisherCheck(short).fits("9780451000000")).toBe(true);
  // a long one that's all over the place
  const starts = ["9781421", "9781974", "9780451", "9781435", "9780316"];
  const mixed = Array.from({ length: 10 }, (_, i) =>
    under(starts[i % 5]!, i + 1),
  );
  expect(publisherCheck(mixed).odd.size).toBe(0);
});

test("a multiplication sign in a title is the letter x", () => {
  // Open Library's spelling of the publisher's own volumes
  for (const title of [
    "Hunter × Hunter, Volume 27",
    "HUNTER×HUNTER, Vol. 27",
    "Hunter x Hunter, Vol. 27",
  ])
    expect(seriesOf(title)).toBe("hunter x hunter");
  expect(seriesOf("SPY×FAMILY, Vol. 3")).toBe(seriesOf("Spy x Family, Vol. 3"));
});

test("the printed book of a volume is listed, never its digital edition", () => {
  const print = { ...book(13, "9781421510699") };
  const digital = { ...book(13, "9781421554129"), ebook: true as const };
  // found together, in either order
  expect(mergeVolumes([], [digital, print]).map((v) => v.isbn13)).toEqual([
    print.isbn13,
  ]);
  expect(mergeVolumes([], [print, digital]).map((v) => v.isbn13)).toEqual([
    print.isbn13,
  ]);
  // a digital one saved before gives way; a printed one saved never does
  expect(mergeVolumes([digital], [print])[0]!.isbn13).toBe(print.isbn13);
  expect(mergeVolumes([print], [digital])[0]!.isbn13).toBe(print.isbn13);
  // with no printed book found, the digital one still fills the place
  expect(mergeVolumes([], [digital])[0]!.isbn13).toBe(digital.isbn13);
});

test("a work is listed under its printed book's ISBN, not its eBook's", () => {
  // the work's own list, eBook first, as Open Library sent Hunter x Hunter 13
  const isbn = ["8577871509", "9781421554129", "9781421510699"];
  const paperback = {
    isbn: ["9781421510699", "1421510693"],
    format: ["Paperback"],
  };
  expect(isbnToListUnder({ isbn, editions: { docs: [paperback] } })).toBe(
    "9781421510699",
  );
  // the matched edition is the eBook: the work's other English ISBN, the
  // book's (Hunter x Hunter 27)
  const ebook = { isbn: ["9781421554129"], format: ["eBook"] };
  expect(isbnToListUnder({ isbn, editions: { docs: [ebook] } })).toBe(
    "9781421510699",
  );
  // the eBook's own only when the work has no other
  expect(
    isbnToListUnder({ isbn: ["9781421554129"], editions: { docs: [ebook] } }),
  ).toBe("9781421554129");
  // no matched edition: the work's first English ISBN, as before
  expect(isbnToListUnder({ isbn })).toBe("9781421554129");
  // an edition in another language says nothing either
  const brazil = { isbn: ["9788577871506"], format: ["Paperback"] };
  expect(isbnToListUnder({ isbn, editions: { docs: [brazil] } })).toBe(
    "9781421554129",
  );
});

test("a work is never listed under a library rebind's ISBN while it has another", () => {
  // Sgt. Frog 1: the search matched the school rebind
  const isbn = ["9780329405762", "9781591827030"];
  const rebind = { isbn: ["9780329405762"], format: ["Library Binding"] };
  expect(isbnToListUnder({ isbn, editions: { docs: [rebind] } })).toBe(
    "9781591827030",
  );
  // with no matched edition either
  expect(isbnToListUnder({ isbn })).toBe("9781591827030");
  // a rebind is all there is: it still fills the place
  expect(isbnToListUnder({ isbn: ["9780329405762"] })).toBe("9780329405762");
});

test("an ISBN two works both claim is trusted for neither", () => {
  // Bleach 9 and 11: the search matched volume 11's edition for both
  const shared = { isbn: ["9781591169246"], format: ["Paperback"] };
  const nine = {
    isbn: ["9781591169246", "9781421500812"],
    editions: { docs: [shared] },
  };
  const eleven = {
    isbn: ["9781415638644", "9781421502717", "9781591169246"],
    editions: { docs: [shared] },
  };
  const alone = { isbn: ["9781421506111"] };
  expect(isbnsToListUnder([nine, eleven, alone])).toEqual([
    // each its own other edition, and never the rebind while there's another
    "9781421500812",
    "9781421502717",
    "9781421506111",
  ]);
  // with no other edition to its name, a work keeps the shared one
  const onlyThat = { isbn: ["9781591169246"], editions: { docs: [shared] } };
  expect(isbnsToListUnder([onlyThat, eleven])[0]).toBe("9781591169246");
});
