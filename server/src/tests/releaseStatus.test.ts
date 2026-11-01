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

const volumesOnly = (englishVolumes: { volume: number | null }[]) => ({
  dates: null,
  englishVolumes,
});
const chaptersOnly = (dates: FormatedDates | null) => ({
  dates,
  englishVolumes: [],
});

test("a new volume is any English one past what they own", () => {
  const out = volumesOnly(english(24, 25));
  expect(getReleaseStatus(owns(24), out).hasNewVolume).toBe(true);
  expect(getReleaseStatus(owns(3), out).hasNewVolume).toBe(true);
  expect(getReleaseStatus(owns(25), out).hasNewVolume).toBe(false);
});

test("a blank on the shelf doesn't hide anything", () => {
  expect(getReleaseStatus(owns(null), volumesOnly(english(25))).hasNewVolume).toBe(true);
  expect(getReleaseStatus(readTo(null), chaptersOnly(chapter("250"))).hasNewChapter).toBe(true);
});

test("no English volumes means no new volume", () => {
  expect(getReleaseStatus(owns(3), volumesOnly([])).hasNewVolume).toBe(false);
});

test("the highest numbered English volume counts, in any order", () => {
  const status = getReleaseStatus(owns(9), volumesOnly(english(10, null, 2)));
  expect(status.latestVolume).toBe(10);
});

test("a new chapter means the latest is past their bookmark", () => {
  expect(getReleaseStatus(readTo(203), chaptersOnly(chapter("250"))).hasNewChapter).toBe(true);
  expect(getReleaseStatus(readTo(250), chaptersOnly(chapter("250"))).hasNewChapter).toBe(false);
  expect(getReleaseStatus(readTo(203), chaptersOnly(chapter(null))).hasNewChapter).toBe(false);
});

test("a Japanese volume counts only past what they own and what's in English", () => {
  const dates = {
    volume: [{ volume: "26", releaseDate: "Today" }, { volume: null, releaseDate: null }],
  } as FormatedDates;
  const ahead = (owned: number, englishVolumes: { volume: number | null }[]) =>
    getReleaseStatus(owns(owned), { dates, englishVolumes }).hasNewJapaneseVolume;
  expect(ahead(25, english(25))).toBe(true);
  expect(ahead(3, [])).toBe(true);
  expect(getReleaseStatus(owns(null), { dates, englishVolumes: [] }).hasNewJapaneseVolume).toBe(true);
  expect(ahead(26, english(25))).toBe(false);
  expect(ahead(20, english(26))).toBe(false);
});

test("volumes still work when MangaDex couldn't answer", () => {
  const status = getReleaseStatus(
    { volumesOwned: 24, bookmark: 203 },
    { dates: null, englishVolumes: english(25) },
  );
  expect(status.hasNewVolume).toBe(true);
  expect(status.hasNewChapter).toBe(false);
});
