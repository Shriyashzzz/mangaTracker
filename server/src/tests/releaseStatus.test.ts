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

test("a new volume only counts when they're within 3 of it", () => {
  const out = volumesOnly(english(24, 25));
  expect(getReleaseStatus(owns(24), out).hasNewVolume).toBe(true);
  expect(getReleaseStatus(owns(22), out).hasNewVolume).toBe(true);
  expect(getReleaseStatus(owns(21), out).hasNewVolume).toBe(false);
  expect(getReleaseStatus(owns(3), out).hasNewVolume).toBe(false);
  expect(getReleaseStatus(owns(25), out).hasNewVolume).toBe(false);
});

test("a blank on the shelf can't say they've caught up", () => {
  expect(getReleaseStatus(owns(null), volumesOnly(english(25))).hasNewVolume).toBe(false);
  expect(getReleaseStatus(readTo(null), chaptersOnly(chapter("250"))).hasNewChapter).toBe(false);
});

test("no English volumes means no new volume", () => {
  expect(getReleaseStatus(owns(3), volumesOnly([])).hasNewVolume).toBe(false);
});

test("the highest numbered English volume counts, in any order", () => {
  const status = getReleaseStatus(owns(9), volumesOnly(english(10, null, 2)));
  expect(status.latestVolume).toBe(10);
});

test("a new chapter only counts when they're nearly up to it", () => {
  const out = chaptersOnly(chapter("250"));
  expect(getReleaseStatus(readTo(249), out).hasNewChapter).toBe(true);
  // a few came out since they last read: still caught up
  expect(getReleaseStatus(readTo(247), out).hasNewChapter).toBe(true);
  expect(getReleaseStatus(readTo(246), out).hasNewChapter).toBe(false);
  expect(getReleaseStatus(readTo(203), out).hasNewChapter).toBe(false);
  expect(getReleaseStatus(readTo(250), out).hasNewChapter).toBe(false);
  expect(getReleaseStatus(readTo(203), chaptersOnly(chapter(null))).hasNewChapter).toBe(false);
});

test("a Japanese volume counts only once they've caught up with English", () => {
  const dates = {
    volume: [{ volume: "26", releaseDate: "Today" }, { volume: null, releaseDate: null }],
  } as FormatedDates;
  const ahead = (owned: number | null, englishVolumes: { volume: number | null }[]) =>
    getReleaseStatus(owns(owned), { dates, englishVolumes }).hasNewJapaneseVolume;
  expect(ahead(25, english(25))).toBe(true);
  expect(ahead(3, [])).toBe(true);
  expect(ahead(null, [])).toBe(false);
  expect(ahead(26, english(25))).toBe(false);
  expect(ahead(20, english(25))).toBe(false);
  expect(ahead(20, english(26))).toBe(false);
});

test("no answer from the catalog means we can't call a volume ahead of English", () => {
  const dates = { volume: [{ volume: "26", releaseDate: null }] } as FormatedDates;
  const status = getReleaseStatus(owns(3), { dates, englishVolumes: null });
  expect(status.hasNewJapaneseVolume).toBe(false);
  expect(status.hasNewVolume).toBe(false);
});

test("volumes still work when MangaDex couldn't answer", () => {
  const status = getReleaseStatus(
    { volumesOwned: 24, bookmark: 203 },
    { dates: null, englishVolumes: english(25) },
  );
  expect(status.hasNewVolume).toBe(true);
  expect(status.hasNewChapter).toBe(false);
});

describe("the panel's next volume", () => {
  const starts = [
    { volume: 1, firstChapter: 1 },
    { volume: 2, firstChapter: 10 },
    { volume: 3, firstChapter: 19 },
  ];
  const status = (
    volumesOwned: number | null,
    bookmark: number | null,
    latest: number,
  ) =>
    getReleaseStatus(
      { volumesOwned, bookmark },
      {
        dates: { volumeStarts: starts } as FormatedDates,
        englishVolumes: english(latest),
      },
    );

  test("shows only when they're on the volume before the newest", () => {
    expect(status(13, null, 14).isNextVolumeOut).toBe(true);
    expect(status(14, null, 14).isNextVolumeOut).toBe(false);
    expect(status(12, null, 14).isNextVolumeOut).toBe(false);
    // the New tab allows a little more room
    expect(status(12, null, 14).hasNewVolume).toBe(true);
    expect(status(10, null, 14).hasNewVolume).toBe(false);
  });

  test("works out where they are from their chapter", () => {
    const fromChapter = status(null, 12, 3);
    expect(fromChapter.currentVolume).toBe(2);
    expect(fromChapter.isNextVolumeOut).toBe(true);
    expect(status(null, 12, 4).isNextVolumeOut).toBe(false);
  });

  test("what they own wins over their chapter", () => {
    // own 2, read past vol. 3 online: vol. 3 is still the next one for them
    expect(status(2, 500, 3).currentVolume).toBe(2);
    expect(status(2, 500, 3).isNextVolumeOut).toBe(true);
  });

  test("with nothing to go on it stays hidden", () => {
    expect(status(null, null, 3).isNextVolumeOut).toBe(false);
    expect(status(null, 0, 3).currentVolume).toBeNull();
  });
});

test("seen it hides that release, until a newer one is out", () => {
  const shelved = { ...owns(24), seenVolume: 25 };
  expect(
    getReleaseStatus(shelved, volumesOnly(english(24, 25))).hasNewVolume,
  ).toBe(false);
  expect(
    getReleaseStatus({ ...owns(25), seenVolume: 25 }, volumesOnly(english(25, 26)))
      .hasNewVolume,
  ).toBe(true);
});

test("seen it on a chapter leaves volumes alone, and the other way round", () => {
  const out = { dates: chapter("100"), englishVolumes: english(25) };
  const seenChapter = getReleaseStatus(
    { volumesOwned: 24, bookmark: 99, seenChapter: 100 },
    out,
  );
  expect(seenChapter.hasNewChapter).toBe(false);
  expect(seenChapter.hasNewVolume).toBe(true);
  const seenVolume = getReleaseStatus(
    { volumesOwned: 24, bookmark: 99, seenVolume: 25 },
    out,
  );
  expect(seenVolume.hasNewChapter).toBe(true);
  expect(seenVolume.hasNewVolume).toBe(false);
});

test("seen it doesn't stop the details panel saying the next volume is out", () => {
  const status = getReleaseStatus(
    { volumesOwned: 24, bookmark: null, seenVolume: 25 },
    volumesOnly(english(24, 25)),
  );
  expect(status.hasNewVolume).toBe(false);
  expect(status.isNextVolumeOut).toBe(true);
});

test("the newest volume comes with what its price page needs", () => {
  const status = getReleaseStatus(owns(24), {
    dates: null,
    englishVolumes: [
      { volume: 24, isbn13: "9780000000024", title: "Series, Vol. 24" },
      { volume: 25, isbn13: "9780000000025", title: "Series, Vol. 25" },
    ],
  });
  expect(status.latestVolumeBook).toEqual({
    isbn13: "9780000000025",
    title: "Series, Vol. 25",
  });
  expect(getReleaseStatus(owns(24), volumesOnly(english(25))).latestVolumeBook).toBeNull();
});
