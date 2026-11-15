// Reading where each volume starts from a Wikipedia chapter list page
// (util/releases/wikipediaVolumeStarts.ts), in the ways those pages write it
import { volumeStartsFromWikitext } from "../../util/releases/wikipediaVolumeStarts.js";

const volume = (n: number, chapterList: string) =>
  `{{Graphic novel list\n| VolumeNumber = ${n}\n| ChapterList = ${chapterList}\n}}`;

test("each volume's first chapter, written several ways", () => {
  const page = [
    "{{Graphic novel list/header\n| Language = Japanese\n}}",
    // a numbered list with no start begins at 1
    volume(1, "\n{{Numbered list\n|{{Nihongo|One}}\n}}"),
    volume(2, "\n{{Numbered list|start=8\n|{{Nihongo|Eight}}\n}}"),
    volume(3, "\n*17. {{Nihongo|Seventeen}}\n*18. Next"),
    volume(4, "*Mission: 26–30"),
    volume(5, "\n*Days 35: {{Nihongo|Showtime}}"),
    volume(6, '\n<li value="44">Forty-four</li>'),
  ].join("\n");
  expect(volumeStartsFromWikitext(page)).toEqual([
    { volume: 1, firstChapter: 1 },
    { volume: 2, firstChapter: 8 },
    { volume: 3, firstChapter: 17 },
    { volume: 4, firstChapter: 26 },
    { volume: 5, firstChapter: 35 },
    { volume: 6, firstChapter: 44 },
  ]);
});

test("a second table further down (a spin-off's) ends the list", () => {
  const page = [
    volume(1, "*1. One"),
    volume(2, "*6. Six"),
    // the spin-off starts again at vol. 1
    volume(1, "*1. Spin-off one"),
  ].join("\n");
  expect(volumeStartsFromWikitext(page)).toEqual([
    { volume: 1, firstChapter: 1 },
    { volume: 2, firstChapter: 6 },
  ]);
});

test("a page without volume tables has nothing", () => {
  expect(volumeStartsFromWikitext("Just an article about a manga.")).toEqual(
    [],
  );
});
