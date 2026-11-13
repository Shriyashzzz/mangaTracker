import { withFixes } from "../../prices/afterAnime/animeFixes.js";
import { readAnimeStops } from "../../prices/afterAnime/animeLines.js";

const stops = readAnimeStops(
  "Vol 1, Chap 1 (S1) / Vol 8, Chap 64 (S2)",
  "Vol 8, Chap 63 (S1) / Vol 16, Chap 137 (S2)",
);

test("with no fixes, every season is as MangaUpdates says", () => {
  const shown = withFixes(stops, []);
  expect(shown.map((stop) => stop.corrected)).toEqual([false, false]);
  expect(shown[1]).toMatchObject({ endChapter: 137, nextChapter: 138 });
});

test("a fix replaces the season it names, whatever its capitals", () => {
  const shown = withFixes(stops, [
    { label: "season 2", chapter: 139, volume: 16 },
  ]);
  expect(shown).toHaveLength(2);
  expect(shown[0]!.corrected).toBe(false);
  // the old end volume went with the old chapter
  expect(shown[1]).toMatchObject({
    label: "Season 2",
    endChapter: 139,
    endVolume: null,
    nextChapter: 140,
    nextVolume: 16,
    corrected: true,
  });
});

test("a fix that only names the volume keeps the chapter", () => {
  const [, second] = withFixes(stops, [
    { label: "Season 2", chapter: null, volume: 17 },
  ]);
  expect(second).toMatchObject({
    endChapter: 137,
    endVolume: 16,
    nextChapter: 138,
    nextVolume: 17,
  });
});

test("a fix for a season the line doesn't have adds it", () => {
  const shown = withFixes(
    [],
    [{ label: "Season 1", chapter: 24.5, volume: 4 }],
  );
  expect(shown).toEqual([
    {
      label: "Season 1",
      endVolume: null,
      endChapter: 24.5,
      endsMidChapter: false,
      nextChapter: 25,
      nextVolume: 4,
      note: "",
      corrected: true,
    },
  ]);
});

test("the newest fix for a season wins", () => {
  const [first] = withFixes(stops, [
    { label: "Season 1", chapter: 60, volume: null },
    { label: "Season 1", chapter: 62, volume: 8 },
  ]);
  expect(first).toMatchObject({ endChapter: 62, nextVolume: 8 });
});
