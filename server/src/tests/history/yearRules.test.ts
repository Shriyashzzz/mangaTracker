// A reader's year in manga, added up (src/history/yearRules.ts)
import { yearInManga, type YearEvent } from "../../history/yearRules.js";

const on = (iso: string) => new Date(`${iso}T12:00:00Z`);
const ev = (
  series: string,
  kind: string,
  amount: number,
  iso: string,
): YearEvent => ({ series, kind, amount, at: on(iso) });

const shelf = [
  { name: "Berserk", genre: "Action", owned: 41, rating: 5 },
  { name: "Blue Box", genre: "Romance", owned: 3, rating: 4 },
  { name: "Vagabond", genre: "Action", owned: 37, rating: 5 },
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
      { name: "Blue Box", chapters: 30, volumes: 0 },
      { name: "Vagabond", chapters: 0, volumes: 3 },
    ],
    busiestMonth: 5,
    shelf: {
      series: 3,
      volumes: 81,
      topGenre: "Action",
      fiveStars: ["Berserk", "Vagabond"],
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
