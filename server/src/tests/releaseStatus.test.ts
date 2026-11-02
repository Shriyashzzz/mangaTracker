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

test("the new volume is the next one they can buy, however far behind", () => {
  const out = volumesOnly(english(13, 14, 15, 20));
  const on13 = getReleaseStatus(owns(13), out);
  expect(on13.hasNewVolume).toBe(true);
  expect(on13.nextVolume).toBe(14);
  // the catalog can have gaps
  expect(getReleaseStatus(owns(15), out).nextVolume).toBe(20);
  expect(getReleaseStatus(owns(20), out).hasNewVolume).toBe(false);
  expect(getReleaseStatus(owns(20), out).nextVolume).toBeNull();
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

test("a new chapter only counts when it's the next one for them", () => {
  const out = chaptersOnly(chapter("250"));
  expect(getReleaseStatus(readTo(249), out).hasNewChapter).toBe(true);
  expect(getReleaseStatus(readTo(248), out).hasNewChapter).toBe(false);
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
    // the New tab lists the next volume whatever the newest is
    expect(status(12, null, 14).hasNewVolume).toBe(true);
    expect(status(12, null, 14).nextVolume).toBe(14);
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

test("seen it hides that volume, until they've moved past it", () => {
  const out = volumesOnly(english(13, 14, 15));
  expect(
    getReleaseStatus({ ...owns(13), seenVolume: 14 }, out).hasNewVolume,
  ).toBe(false);
  const moved = getReleaseStatus({ ...owns(14), seenVolume: 14 }, out);
  expect(moved.hasNewVolume).toBe(true);
  expect(moved.nextVolume).toBe(15);
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

test("the next volume comes with what its price page needs", () => {
  const status = getReleaseStatus(owns(13), {
    dates: null,
    englishVolumes: [
      { volume: 14, isbn13: "9780000000014", title: "Series, Vol. 14" },
      { volume: 15, isbn13: "9780000000015", title: "Series, Vol. 15" },
    ],
  });
  expect(status.nextVolumeBook).toEqual({
    isbn13: "9780000000014",
    title: "Series, Vol. 14",
  });
  expect(getReleaseStatus(owns(13), volumesOnly(english(14))).nextVolumeBook).toBeNull();
});
