// the book import is the site's, run in the browser, but has no DOM in it
import {
  groupBooks,
  titleSaysLightNovel,
  parseCsv,
  readBooks,
  toEntry,
} from "../../../client/src/lib/bookImport.js";

const goodreads = (titles: string[]) =>
  readBooks(
    parseCsv(
      [
        "Book Id,Title,Exclusive Shelf,Owned Copies,My Rating,Read Count,Bookshelves",
        ...titles.map((t, i) => `${i},"${t}",read,1,0,1,`),
      ].join("\n"),
    ),
    "goodreads",
  );

test("publishers' light novel tags are spotted", () => {
  expect(titleSaysLightNovel("Overlord, Vol. 1 (light novel): The Undead King")).toBe(true);
  expect(titleSaysLightNovel("Re:ZERO, Vol. 2 (Light Novel)")).toBe(true);
  expect(titleSaysLightNovel("Spice and Wolf, Vol. 3 (LN)")).toBe(true);
  expect(titleSaysLightNovel("Overlord, Vol. 1 (manga)")).toBe(false);
  expect(titleSaysLightNovel("One Piece, Vol. 1: Romance Dawn")).toBe(false);
});

test("the light novel and the manga of a series come in apart", () => {
  const series = groupBooks(
    goodreads([
      "Overlord, Vol. 1 (light novel): The Undead King",
      "Overlord, Vol. 2 (light novel): The Dark Warrior",
      "Overlord, Vol. 1 (manga)",
    ]),
  );
  expect(series).toHaveLength(2);
  const novel = series.find((s) => s.lightNovel)!;
  const manga = series.find((s) => !s.lightNovel)!;
  expect(novel.title).toBe("Overlord");
  expect(novel.books).toBe(2);
  expect(novel.ownedVolumes).toBe(2);
  expect(manga.books).toBe(1);
  expect(toEntry(novel).lightNovel).toBe(true);
  expect(toEntry(manga).lightNovel).toBeUndefined();
});

test("a CSV can say so in a Type column, like the shelf's own export", () => {
  const books = readBooks(
    parseCsv("Title,Type,Status\nSpice and Wolf,Light novel,Reading\nBerserk,Manga,Reading"),
    "csv",
  );
  expect(books.map((b) => b.lightNovel)).toEqual([true, false]);
});

test("the light novel tag doesn't stay in the series name", () => {
  const [series] = groupBooks(
    readBooks(
      parseCsv("Title,Series\nSpice and Wolf Vol. 1,Spice and Wolf (Light Novel)"),
      "csv",
    ),
  );
  expect(series!.title).toBe("Spice and Wolf");
  expect(series!.lightNovel).toBe(true);
});
