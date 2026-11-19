// What goes in a reader's weekly email (src/digest/digestRules.ts)
import {
  isEmpty,
  keysOf,
  priceDrops,
  releaseNews,
  withoutSent,
  type DigestSeries,
  type PricedVolume,
} from "../../digest/digestRules.js";
import type { EditionLine } from "../../prices/editionLines.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
// a day so many days from today, as the lists write it
const day = (offset: number) =>
  new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10);
const today = day(0);
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// a series whose volumes came out on these days (null: no day known)
const series = (
  days: (string | null)[],
  over: Partial<DigestSeries> = {},
): DigestSeries => ({
  mangaId: 7,
  name: "Blue Box",
  readVolume: null,
  owned: [],
  line: null,
  volumes: days.map((published, i) => ({
    volume: i + 1,
    isbn13: `978000000000${i}`,
    title: `Blue Box, Vol. ${i + 1}`,
    published,
  })),
  ...over,
});
const news = (s: DigestSeries) => releaseNews([s], today);

test("the next volume, out this month, is news for someone caught up", () => {
  const got = news(series([day(-400), day(-200), day(-5)], { owned: [1, 2] }));
  expect(got.out).toEqual([
    {
      key: "out:7:3",
      kind: "out",
      mangaId: 7,
      series: "Blue Box",
      book: "Vol. 3",
      day: day(-5),
    },
  ]);
  expect(got.soon).toEqual([]);
});

test("a reader who only reads it hears too, by where they've read to", () => {
  const got = news(series([day(-400), day(-200), day(-5)], { readVolume: 2 }));
  expect(got.out.map((i) => i.book)).toEqual(["Vol. 3"]);
});

test("their next volume with a day coming up is said as coming", () => {
  const got = news(series([day(-400), day(-200), day(20)], { owned: [1, 2] }));
  expect(got.soon.map((i) => [i.key, i.day])).toEqual([["soon:7:3", day(20)]]);
  expect(got.out).toEqual([]);
});

test("nothing is said that isn't certain or isn't news", () => {
  const quiet = (s: DigestSeries) => expect(isEmpty({ ...news(s), drops: [] }));
  // none of the series is theirs yet
  quiet(series([day(-5)])).toBe(true);
  // two volumes behind: a backlog
  quiet(series([day(-400), day(-30), day(-5)], { owned: [1] })).toBe(true);
  // out long ago
  quiet(series([day(-400), day(-90)], { owned: [1] })).toBe(true);
  // a long way off
  quiet(series([day(-400), day(200)], { owned: [1] })).toBe(true);
  // a month alone, or no day at all
  quiet(series([day(-400), today.slice(0, 7)], { owned: [1] })).toBe(true);
  quiet(series([day(-400), null], { owned: [1] })).toBe(true);
  // the one after it has no day: it may be out too
  quiet(series([day(-400), day(-5), null], { owned: [1] })).toBe(true);
  // they have every volume there is
  quiet(series([day(-400), day(-5)], { owned: [1, 2] })).toBe(true);
});

// ---------- collected as an edition ----------
const three = (book: number) => [book * 3 - 2, book * 3 - 1, book * 3];
const lineOf = (days: (string | null)[]): EditionLine =>
  ({
    key: "vizbig",
    kind: "omnibus",
    label: "VIZBIG",
    books: days.map((published, i) => ({
      number: i + 1,
      volumes: three(i + 1),
      isbn13: `978111111111${i}`,
      title: null,
      listed: true,
      published,
    })),
  }) as EditionLine;

test("an edition collector hears about books, not volumes", () => {
  const line = lineOf([day(-900), day(-600), day(-4), day(30)]);
  // owns books 1 and 2: the third is just out
  const out = news(series([], { owned: upTo(6), line, name: "Vagabond" }));
  expect(out.out).toEqual([
    {
      key: "out:7:vizbig3",
      kind: "out",
      mangaId: 7,
      series: "Vagabond",
      book: "VIZBIG 3",
      day: day(-4),
    },
  ]);
  // owns all three out: the fourth has a day
  const soon = news(series([], { owned: upTo(9), line }));
  expect(soon.soon.map((i) => i.book)).toEqual(["VIZBIG 4"]);
  // owns only the first: two behind, nothing said
  const behind = news(series([], { owned: upTo(3), line }));
  expect(isEmpty({ ...behind, drops: [] })).toBe(true);
});

// ---------- price drops ----------
const priced = (over: Partial<PricedVolume> = {}): PricedVolume => ({
  isbn13: "9781421520544",
  title: "Vagabond, Vol. 12",
  cents: 1100,
  store: "Books-A-Million",
  checkedAt: new Date(now.getTime() - DAY),
  usualCents: 1500,
  ...over,
});

test("a To buy volume clearly under its usual price is a drop", () => {
  expect(priceDrops([priced()], now)).toEqual([
    {
      key: "drop:9781421520544",
      kind: "drop",
      isbn13: "9781421520544",
      title: "Vagabond, Vol. 12",
      cents: 1100,
      usualCents: 1500,
      store: "Books-A-Million",
    },
  ]);
});

test("a price that's close, stale, or has nothing to compare isn't", () => {
  // 7% under
  expect(priceDrops([priced({ cents: 1400 })], now)).toEqual([]);
  // last asked a week ago: it may have gone back up
  const old = new Date(now.getTime() - 7 * DAY);
  expect(priceDrops([priced({ checkedAt: old })], now)).toEqual([]);
  // no history
  expect(priceDrops([priced({ usualCents: null })], now)).toEqual([]);
  // 20% off a $4 book saves under a dollar
  expect(priceDrops([priced({ cents: 320, usualCents: 400 })], now)).toEqual(
    [],
  );
});

// ---------- said once ----------
test("a release is told once; a price again only after a month", () => {
  const releases = news(
    series([day(-400), day(-200), day(-5)], { owned: [1, 2] }),
  );
  const digest = { ...releases, drops: priceDrops([priced()], now) };
  expect(keysOf(digest)).toEqual(["out:7:3", "drop:9781421520544"]);

  const lastWeek = new Date(now.getTime() - 7 * DAY);
  const told = keysOf(digest).map((item) => ({ item, sentAt: lastWeek }));
  expect(isEmpty(withoutSent(digest, told, now))).toBe(true);

  const longAgo = new Date(now.getTime() - 40 * DAY);
  const toldLongAgo = keysOf(digest).map((item) => ({ item, sentAt: longAgo }));
  // the price is news again; the release never is
  expect(keysOf(withoutSent(digest, toldLongAgo, now))).toEqual([
    "drop:9781421520544",
  ]);
});
