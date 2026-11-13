// the words the client says for a season (client/src/lib/afterAnimeText.ts),
// over what the server's reader makes of real MangaUpdates lines
import {
  afterLabel,
  endText,
  startText,
  twoVolumesNote,
  volumesToGet,
  type AnimeStop,
} from "../../../../client/src/lib/afterAnimeText.js";
import { readAnimeStops } from "../../prices/afterAnime/animeLines.js";

const shown = (start: string, end: string): AnimeStop[] =>
  readAnimeStops(start, end).map((stop) => ({
    ...stop,
    corrected: false,
    coversAll: false,
  }));

const [first, second, third] = shown(
  "Vol 1, Chap 1 (S1) / Vol 8, Chap 64 (S2) / Vol 16, Chap 138 (S3)",
  "Vol 8, Chap 63 (S1) / Vol 16, Chap 137 (S2) / Vol 21, Chap 181 Page 14 (S3)",
) as [AnimeStop, AnimeStop, AnimeStop];

test("a season with a known next volume names that one volume", () => {
  expect(afterLabel(first)).toBe("After Season 1");
  expect(startText(first)).toBe("Start at chapter 64");
  expect(endText(first)).toBe("Season 1 ends at chapter 63, in volume 8.");
  expect(volumesToGet(first)).toEqual([
    { volume: 8, why: "Chapter 64 is in this one" },
  ]);
  expect(twoVolumesNote(first)).toBe("");
  expect(startText(second)).toBe("Start at chapter 138");
});

test("a season that stops mid-chapter starts at that chapter, and offers two volumes", () => {
  expect(startText(third)).toBe("Start at chapter 181");
  expect(endText(third)).toBe(
    "Season 3 stops partway through chapter 181, in volume 21.",
  );
  expect(volumesToGet(third).map((v) => v.volume)).toEqual([21, 22]);
  expect(twoVolumesNote(third)).toBe(
    "Chapter 181 is in volume 21 or 22: it depends on whether the anime ended partway through a volume.",
  );
});

test("no season named reads as the anime", () => {
  const [only] = shown("Vol 1, Chap 1", "Vol 4, Chap 17");
  expect(afterLabel(only!)).toBe("After the anime");
  expect(endText(only!)).toBe("The anime ends at chapter 17, in volume 4.");
});

test("chapters without volumes offer no volume", () => {
  const [only] = shown("Chap 0 (S1)", "Chap 45 (S1)");
  expect(startText(only!)).toBe("Start at chapter 46");
  expect(endText(only!)).toBe("Season 1 ends at chapter 45.");
  expect(volumesToGet(only!)).toEqual([]);
});

test("a volume without a chapter says about where to pick up", () => {
  const [only] = shown("Vol 1, Chap 1", "Vol 18 (1996) Different throughout");
  expect(startText(only!)).toBe("Pick up around volume 18");
  expect(endText(only!)).toBe("1996 ends in volume 18.");
  expect(volumesToGet(only!).map((v) => v.volume)).toEqual([18, 19]);
});

test("an anime that adapts all of it has nothing left to read", () => {
  const all = { ...first, endChapter: 271, coversAll: true };
  expect(startText(all)).toBe("Nothing left to read");
  expect(endText(all)).toBe(
    "Season 1 adapts the manga through its last chapter, 271.",
  );
  expect(volumesToGet(all)).toEqual([]);
});
