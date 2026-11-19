// A reader's year in manga, added up (src/history/yearRules.ts)
import {
  titleOf,
  yearInManga,
  type YearEvent,
} from "../../history/yearRules.js";

const on = (iso: string) => new Date(`${iso}T12:00:00Z`);
const ev = (
  series: string,
  kind: string,
  amount: number,
  iso: string,
): YearEvent => ({ series, kind, amount, at: on(iso) });

const shelf = [
  { name: "Berserk", genre: "Action", owned: 41, rating: 5, image: "b.jpg" },
  { name: "Blue Box", genre: "Romance", owned: 3, rating: 4, image: null },
  { name: "Vagabond", genre: "Action", owned: 37, rating: 5, image: "v.jpg" },
];

test("a year adds up from its history, books and reviews", () => {
  const events = [
    ev("Berserk", "imported", 41, "2026-03-01"),
    ev("Blue Box", "added", 2, "2026-04-02"),
    ev("Blue Box", "owned", 1, "2026-04-20"),
    ev("Blue Box", "chapters", 30, "2026-05-01"),
    // a slip put right
    ev("Blue Box", "chapters", 50, "2026-05-02"),
    ev("Blue Box", "chapters", -50, "2026-05-02"),
    ev("Vagabond", "volumes", 3, "2026-05-10"),
    ev("Vagabond", "finished", 1, "2026-05-11"),
    // last year: not this one
    ev("Vagabond", "chapters", 99, "2025-12-31"),
  ];
  const year = yearInManga(
    2026,
    events,
    [
      { paidCents: 1299, boughtOn: on("2026-04-20") },
      { paidCents: null, boughtOn: on("2026-06-01") },
      { paidCents: 999, boughtOn: on("2025-06-01") },
    ],
    [on("2026-05-03"), on("2025-01-01")],
    shelf,
  );
  expect(year).toEqual({
    year: 2026,
    // 30 chapters in one day is a binge
    title: {
      name: "The Binge Reader",
      line: "You treat 'one more chapter' as a lifestyle.",
    },
    biggestDay: { day: "2026-05-01", chapters: 30, series: "Blue Box" },
    longestStreak: 2,
    firstVolume: { series: "Blue Box", volume: 0, day: "2026-04-20" },
    lastFinished: { series: "Vagabond", day: "2026-05-11" },
    since: "2026-03-01",
    // the import isn't counted: 2 with Blue Box, and 1 ticked
    volumesAdded: 3,
    seriesAdded: 1,
    chaptersRead: 30,
    volumesRead: 3,
    seriesFinished: 1,
    booksBought: 2,
    spentCents: 1299,
    reviews: 1,
    topSeries: [
      { name: "Blue Box", chapters: 30, volumes: 0, image: null },
      { name: "Vagabond", chapters: 0, volumes: 3, image: "v.jpg" },
    ],
    busiestMonth: 5,
    shelf: {
      series: 3,
      volumes: 81,
      topGenre: "Action",
      fiveStars: [
        { name: "Berserk", image: "b.jpg" },
        { name: "Vagabond", image: "v.jpg" },
      ],
    },
  });
});

test("a year with nothing in it says so, and never goes below 0", () => {
  const year = yearInManga(
    2026,
    [ev("Blue Box", "chapters", -5, "2026-02-01")],
    [],
    [],
    [],
  );
  expect(year).toMatchObject({
    chaptersRead: 0,
    topSeries: [],
    shelf: { series: 0, volumes: 0, topGenre: null, fiveStars: [] },
  });
  expect(yearInManga(2026, [], [], [], []).busiestMonth).toBeNull();
  expect(yearInManga(2026, [], [], [], []).since).toBeNull();
});

test("the highlights: biggest day, longest run, first volume", () => {
  const year = yearInManga(
    2026,
    [
      { ...ev("A", "chapters", 5, "2026-03-01") },
      { ...ev("A", "chapters", 7, "2026-03-02") },
      { ...ev("B", "chapters", 20, "2026-03-03") },
      { ...ev("A", "chapters", 4, "2026-03-03") },
      { ...ev("A", "volumes", 1, "2026-03-10") },
      { ...ev("A", "owned", 1, "2026-02-02"), volume: 7 },
    ],
    [],
    [],
    [],
  );
  expect(year.biggestDay).toEqual({
    day: "2026-03-03",
    chapters: 24,
    series: "B",
  });
  expect(year.longestStreak).toBe(3);
  expect(year.firstVolume).toEqual({
    series: "A",
    volume: 7,
    day: "2026-02-02",
  });
  expect(year.lastFinished).toBeNull();
});

test("the title: the first that fits", () => {
  const base = yearInManga(2026, [], [], [], []);
  expect(titleOf(base, 3).name).toBe("The Deluxe Hunter");
  expect(titleOf({ ...base, chaptersRead: 320 }, 0).name).toBe(
    "The Binge Reader",
  );
  expect(titleOf({ ...base, seriesFinished: 3 }, 0).name).toBe(
    "The Completionist",
  );
  expect(
    titleOf(
      {
        ...base,
        chaptersRead: 100,
        topSeries: [
          { name: "Blue Box", chapters: 60, volumes: 0, image: null },
        ],
      },
      0,
    ),
  ).toEqual({
    name: "The Loyalist",
    line: "One series had your heart: Blue Box.",
  });
  expect(titleOf({ ...base, volumesAdded: 40 }, 0).name).toBe(
    "The Shelf Builder",
  );
  expect(titleOf(base, 0).name).toBe("The Collector");
});
