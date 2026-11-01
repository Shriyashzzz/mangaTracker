import { getReleaseStatus } from "../util/releaseStatus.js";
import type { FormatedDates } from "../util/volumeDataFormatter.js";

const english = (...volumes: (number | null)[]) =>
  volumes.map((volume) => ({ volume }));

const chapter = (chapterNumber: string | null) =>
  ({
    chapter: { latestReleased: { chapterNumber, releaseDate: "Today" } },
  }) as FormatedDates;

const owns = (volumesOwned: number | null) => ({ volumesOwned, bookmark: null });
const readTo = (bookmark: number | null) => ({ volumesOwned: null, bookmark });

const volumesOnly = (englishVolumes: { volume: number | null }[], anilistMax: number | null) => ({
  dates: null,
  englishVolumes,
  anilistMax,
});
const chaptersOnly = (dates: FormatedDates | null) => ({
  dates,
  englishVolumes: [],
  anilistMax: null,
});

test("a new volume needs them to own AniList's max and be behind in English", () => {
  const out = volumesOnly(english(24, 25), 24);
  expect(getReleaseStatus(owns(24), out).hasNewVolume).toBe(true);
  expect(getReleaseStatus(owns(20), out).hasNewVolume).toBe(false);
  expect(getReleaseStatus(owns(25), out).hasNewVolume).toBe(false);
});

test("with no AniList count, the English catalog alone decides", () => {
  const out = volumesOnly(english(25), null);
  expect(getReleaseStatus(owns(3), out).hasNewVolume).toBe(true);
  expect(getReleaseStatus(owns(25), out).hasNewVolume).toBe(false);
});

test("owning nothing we know of, or no English volumes, is never a new volume", () => {
  expect(getReleaseStatus(owns(null), volumesOnly(english(25), null)).hasNewVolume).toBe(false);
  expect(getReleaseStatus(owns(3), volumesOnly([], null)).hasNewVolume).toBe(false);
});

test("the highest numbered English volume counts, in any order", () => {
  const status = getReleaseStatus(owns(9), volumesOnly(english(10, null, 2), null));
  expect(status.latestVolume).toBe(10);
});

test("a new chapter means the latest is past their bookmark", () => {
  expect(getReleaseStatus(readTo(203), chaptersOnly(chapter("250"))).hasNewChapter).toBe(true);
  expect(getReleaseStatus(readTo(250), chaptersOnly(chapter("250"))).hasNewChapter).toBe(false);
  expect(getReleaseStatus(readTo(null), chaptersOnly(chapter("250"))).hasNewChapter).toBe(false);
  expect(getReleaseStatus(readTo(203), chaptersOnly(chapter(null))).hasNewChapter).toBe(false);
});

test("volumes still work when MangaDex couldn't answer", () => {
  const status = getReleaseStatus(
    { volumesOwned: 24, bookmark: 203 },
    { dates: null, englishVolumes: english(25), anilistMax: null },
  );
  expect(status.hasNewVolume).toBe(true);
  expect(status.hasNewChapter).toBe(false);
});
