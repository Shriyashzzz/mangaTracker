import { pickHit } from "../../prices/sources/mangaUpdates.js";
import { withChapterSource } from "../../util/releases/releaseCache.js";
import type { FormatedDates } from "../../util/releases/volumeDataFormatter.js";

const mangaDex = (chapterNumber: string) =>
  ({
    chapter: {
      latestReleased: { chapterNumber, releaseDate: "2026-10-01T00:00:00Z" },
      estimateRelease: {
        chapterNumber: "16",
        releaseDate: "2026-11-01T00:00:00Z",
        isEstimate: true,
        confidence: "low",
      },
    },
  }) as FormatedDates;

test("the higher count wins, since MangaDex loses licensed chapters", () => {
  const out = withChapterSource(mangaDex("15"), {
    latestChapter: 201,
    finished: false,
  });
  expect(out?.chapter?.latestReleased.chapterNumber).toBe("201");
  // no date for it, and MangaDex's next chapter guess is now meaningless
  expect(out?.chapter?.latestReleased.releaseDate).toBeNull();
  expect(out?.chapter?.estimateRelease.chapterNumber).toBeNull();
});

test("MangaDex is kept, date and all, when it's ahead or level", () => {
  for (const latestChapter of [33, 51]) {
    const out = withChapterSource(mangaDex("51"), {
      latestChapter,
      finished: false,
    });
    expect(out?.chapter?.latestReleased.chapterNumber).toBe("51");
    expect(out?.chapter?.latestReleased.releaseDate).not.toBeNull();
  }
});

test("a finished series is marked as finished", () => {
  const out = withChapterSource(mangaDex("15"), {
    latestChapter: 15,
    finished: true,
  });
  expect(out?.seriesFinished).toBe(true);
});

test("it works when only one source answers", () => {
  expect(
    withChapterSource(mangaDex("15"), null)?.chapter?.latestReleased
      .chapterNumber,
  ).toBe("15");
  expect(
    withChapterSource(null, { latestChapter: 9, finished: false })?.chapter
      ?.latestReleased.chapterNumber,
  ).toBe("9");
  expect(withChapterSource(null, null)).toBeNull();
});

test("a MangaUpdates hit has to be the series, and the manga", () => {
  const hits = [
    {
      record: {
        series_id: 1,
        title: "Violet Evergarden (Novel)",
        type: "Novel",
      },
      hit_title: "Violet Evergarden",
    },
    {
      record: {
        series_id: 2,
        title: "Tsue to Tsurugi no Wistoria",
        type: "Manga",
      },
      hit_title: "Wistoria: Wand and Sword",
    },
    { record: { series_id: 3, title: "Solo Leveling", type: "Novel" } },
  ];
  expect(pickHit(hits, ["Violet Evergarden"])).toBeNull();
  expect(pickHit(hits, ["Wistoria: Wand and Sword"])?.record.series_id).toBe(2);
  expect(pickHit(hits, ["Some Other Series"])).toBeNull();
});
