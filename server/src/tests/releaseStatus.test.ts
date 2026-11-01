import { getReleaseStatus } from "../util/releaseStatus.js";
import type { FormatedDates } from "../util/volumeDataFormatter.js";

const dates = (volumes: (string | null)[], chapter: string | null) =>
  ({
    volume: volumes.map((volume) => ({ volume, releaseDate: "Today" })),
    chapter: { latestReleased: { chapterNumber: chapter, releaseDate: "Today" } },
  }) as FormatedDates;

const shelf = (volumesOwned: number | null, bookmark: number | null = null) => ({
  volumesOwned,
  bookmark,
});

test("a new volume needs them to own AniList's max and be behind MangaDex", () => {
  const out = dates(["24", "25"], null);
  expect(getReleaseStatus(shelf(24), out, 24).hasNewVolume).toBe(true);
  expect(getReleaseStatus(shelf(20), out, 24).hasNewVolume).toBe(false);
  expect(getReleaseStatus(shelf(25), out, 24).hasNewVolume).toBe(false);
});

test("with no AniList count, MangaDex alone decides", () => {
  const out = dates(["25"], null);
  expect(getReleaseStatus(shelf(3), out, null).hasNewVolume).toBe(true);
  expect(getReleaseStatus(shelf(25), out, null).hasNewVolume).toBe(false);
});

test("owning nothing we know of is never a new volume", () => {
  expect(getReleaseStatus(shelf(null), dates(["25"], null), null).hasNewVolume).toBe(false);
});

test("the highest numbered volume counts, whatever order or junk came back", () => {
  const status = getReleaseStatus(shelf(9), dates(["10", null, "2", "n/a"], null), null);
  expect(status.latestVolume).toBe(10);
});

test("a new chapter means the latest is past their bookmark", () => {
  expect(getReleaseStatus(shelf(null, 203), dates([], "250"), null).hasNewChapter).toBe(true);
  expect(getReleaseStatus(shelf(null, 250), dates([], "250"), null).hasNewChapter).toBe(false);
  expect(getReleaseStatus(shelf(null, null), dates([], "250"), null).hasNewChapter).toBe(false);
  expect(getReleaseStatus(shelf(null, 203), dates([], null), null).hasNewChapter).toBe(false);
});
