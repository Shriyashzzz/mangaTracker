// A shared shelf in a few numbers (client/src/pages/SharedShelf/shelfNumbers.ts)
import {
  favouritesOf,
  genresOn,
  shelfNumbers,
  toGetOf,
} from "../../../../client/src/pages/SharedShelf/shelfNumbers.js";
import { onMyShelf } from "../../../../client/src/pages/SharedShelf/compare.js";
import type { SharedManga } from "../../../../client/src/pages/SharedShelf/shareParts.js";

const series = (over: Partial<SharedManga>): SharedManga => ({
  name: "A series",
  image: null,
  genre: null,
  status: false,
  bookmark: null,
  rating: null,
  ...over,
});
const next = {
  volume: 4,
  isbn13: "9780000000004",
  title: "x",
  comingOut: null,
};

test("the numbers: full runs, the longest run, and what they read most", () => {
  const shelf = [
    series({
      name: "Naruto",
      volumesOwned: 72,
      genre: "Action",
      ownsAll: true,
    }),
    series({ name: "Berserk", volumesOwned: 3, genre: "Action" }),
    series({ name: "Monster", volumesOwned: 2, genre: "Drama" }),
    series({ name: "Unsorted", genre: "unlabled" }),
  ];
  const { ownsAll, longestRun, mostly, genres } = shelfNumbers(shelf);
  expect(ownsAll).toBe(1);
  expect(longestRun).toEqual({ name: "Naruto", volumes: 72 });
  expect(mostly).toBe("Action");
  // three series with a genre: too few for the bar to say anything
  expect(genres).toEqual([]);
});

test("a short shelf has no longest run, and no genre no 'mostly'", () => {
  const { longestRun, mostly } = shelfNumbers([
    series({ name: "Akira", volumesOwned: 2 }),
  ]);
  expect(longestRun).toBeNull();
  expect(mostly).toBeNull();
});

test("the genre bar names the biggest four and gathers the rest", () => {
  const of = (genre: string, n: number) =>
    Array.from({ length: n }, (_, i) =>
      series({ name: `${genre} ${i}`, genre }),
    );
  const { genres } = shelfNumbers([
    ...of("Action", 5),
    ...of("Drama", 3),
    ...of("Comedy", 2),
    ...of("Fantasy", 2),
    ...of("Horror", 1),
    ...of("Sports", 1),
  ]);
  expect(genres).toEqual([
    { name: "Action", count: 5 },
    { name: "Drama", count: 3 },
    { name: "Comedy", count: 2 },
    { name: "Fantasy", count: 2 },
    { name: "Other", count: 2 },
  ]);
});

test("favourites are their five-star series", () => {
  const shelf = [
    series({ name: "A", rating: 5 }),
    series({ name: "B", rating: 4 }),
  ];
  expect(favouritesOf(shelf).map((m) => m.name)).toEqual(["A"]);
});

test("to get: series they've started that have a next volume", () => {
  const shelf = [
    series({ name: "Reading", next }),
    series({ name: "Finished", status: true, next }),
    series({ name: "To read", planned: true, next }),
    series({ name: "No next" }),
  ];
  expect(toGetOf(shelf).map((m) => m.name)).toEqual(["Reading", "Finished"]);
});

test("the genre filter offers every genre on the shelf, the most common first", () => {
  const shelf = [
    series({ genre: "Drama" }),
    series({ genre: "Action" }),
    series({ genre: "Action" }),
    series({ genre: "unlabled" }),
    series({ genre: null }),
  ];
  expect(genresOn(shelf)).toEqual(["Action", "Drama"]);
});

test("a series is on the visitor's shelf too when the names match as the shelf matches them", () => {
  const isMine = onMyShelf([
    { name: "One Piece" },
    { name: "Overlord", lightNovel: true },
  ]);
  expect(isMine({ name: "one piece" })).toBe(true);
  expect(isMine({ name: "Berserk" })).toBe(false);
  // a light novel and its manga are two series
  expect(isMine({ name: "Overlord" })).toBe(false);
  expect(isMine({ name: "Overlord", lightNovel: true })).toBe(true);
});
