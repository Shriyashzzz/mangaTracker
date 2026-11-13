// When a series was last changed, carried over by an import so the shelf's
// "Last updated" order survives the move: read from each source's own form
// (client/src/lib/imports/importDate.ts), checked again by the server
// (util/shelf/malEntry.ts changedOn), and kept through a backup and back.
import {
  importDate,
  latestDate,
} from "../../../../client/src/lib/imports/importDate.js";
import {
  groupBooks,
  parseCsv,
  readBooks,
  toEntry,
} from "../../../../client/src/lib/imports/bookImport.js";
import { shelfToCsv } from "../../../../client/src/lib/shelfCsv.js";
import type { Manga } from "../../../../client/src/lib/types.js";
import { changedOn, toMangaInput } from "../../util/shelf/malEntry.js";

const NOW = Date.parse("2026-11-13T12:00:00Z");

test("each source's own form of a date is read", () => {
  // AniList: seconds since 1970
  expect(importDate(1767268800, NOW)).toBe("2026-01-01T12:00:00.000Z");
  // Kitsu, and our own backup
  expect(importDate("2015-09-23T20:19:55.000Z", NOW)).toBe(
    "2015-09-23T20:19:55.000Z",
  );
  // Goodreads
  expect(importDate("2023/05/12", NOW)).toBe("2023-05-12T00:00:00.000Z");
});

test("anything that isn't a believable day in the past is left out", () => {
  // AniList's "never", an empty cell, words, a day before these sites existed
  for (const bad of [0, "", "  ", "soon", "1970-01-01", null, undefined])
    expect(importDate(bad, NOW)).toBeUndefined();
  // next year
  expect(importDate("2027-11-13", NOW)).toBeUndefined();
  // a clock a few hours ahead is still today
  expect(importDate("2026-11-13T20:00:00Z", NOW)).toBeDefined();
});

test("a series of several books takes the latest of their dates", () => {
  expect(
    latestDate([
      "2023-05-12T00:00:00.000Z",
      undefined,
      "2024-01-02T00:00:00.000Z",
    ]),
  ).toBe("2024-01-02T00:00:00.000Z");
  expect(latestDate([undefined, undefined])).toBeUndefined();
});

test("the server checks the date again before keeping it", () => {
  expect(changedOn("2024-01-02T00:00:00.000Z", NOW)).toEqual(
    new Date("2024-01-02T00:00:00.000Z"),
  );
  expect(changedOn("2030-01-01T00:00:00.000Z", NOW)).toBeUndefined();
  expect(changedOn("not a date", NOW)).toBeUndefined();
  expect(changedOn(undefined, NOW)).toBeUndefined();
});

test("a Goodreads file's day read, or else day added, comes along", () => {
  const csv = [
    "Title,Exclusive Shelf,Owned Copies,My Rating,Read Count,Bookshelves,Date Read,Date Added",
    '"Vagabond, Vol. 1",read,1,5,1,,2023/05/12,2021/01/01',
    '"Vagabond, Vol. 2",read,1,5,1,,2024/02/03,2021/01/01',
    '"Monster, Vol. 1",to-read,0,0,0,,,2022/08/09',
  ].join("\n");
  const series = groupBooks(readBooks(parseCsv(csv), "goodreads"));
  const dateOf = (title: string) =>
    series.find((s) => s.title === title)?.updatedAt;
  // the later of the two books read
  expect(dateOf("Vagabond")).toBe("2024-02-03T00:00:00.000Z");
  // never read: the day it was added
  expect(dateOf("Monster")).toBe("2022-08-09T00:00:00.000Z");
});

test("a backup keeps when each series was last changed", () => {
  const manga = (id: number, name: string, updatedAt?: string): Manga => ({
    id,
    userId: 1,
    name,
    genre: null,
    description: null,
    image: null,
    status: false,
    planned: false,
    bookmark: 3,
    volumesOwned: null,
    rating: null,
    ...(updatedAt ? { updatedAt } : {}),
  });
  const csv = shelfToCsv([
    manga(1, "Berserk", "2026-03-01T10:00:00.000Z"),
    // a shelf saved before the date existed
    manga(2, "Monster"),
  ]);
  const series = groupBooks(readBooks(parseCsv(csv), "csv"));
  const input = (title: string) =>
    toMangaInput(
      // no AniList match needed: the backup's own name is used
      toEntry(
        series.find((s) => s.title === title)!,
        undefined,
      ),
      null,
    );
  expect(input("Berserk").updatedAt).toEqual(
    new Date("2026-03-01T10:00:00.000Z"),
  );
  // none in the file: the series gets the time of the import
  expect(input("Monster").updatedAt).toBeUndefined();
});
