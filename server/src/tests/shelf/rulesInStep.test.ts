// Rules the page and the server each keep a copy of (Railway builds each app
// from its own folder, so neither imports the other's): the copies must
// answer the same. A change to one without the other fails here
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as clientReading from "../../../../client/src/lib/reading.js";
import { bookName as pageBookName } from "../../../../client/src/lib/bookName.js";
import { bookName } from "../../prices/editionLines.js";
import { readTrackBy, tracksOf } from "../../util/releases/releaseStatus.js";
import { MOST_TOP } from "../../util/shelf/shareTop.js";
import { realBooks } from "../../util/shelf/realBooks.js";
import { realBooksOf } from "../../../../client/src/lib/editionShelf.js";

test("which counters a series shows: chapters, volumes or both", () => {
  for (const setting of [
    "series",
    "chapters",
    "volumes",
    "both",
    "nonsense",
    undefined,
  ])
    for (const byVolume of [true, false, undefined]) {
      const server = tracksOf(byVolume, readTrackBy(setting));
      const page = clientReading.tracksOf(
        { byVolume },
        clientReading.readTrackBy(setting),
      );
      expect([setting, byVolume, page]).toEqual([setting, byVolume, server]);
    }
});

test("a shared shelf's top picks: the page stops at the server's limit", () => {
  const topPick = fileURLToPath(
    new URL(
      "../../../../client/src/pages/SharedShelf/TopPick.tsx",
      import.meta.url,
    ),
  );
  const found = readFileSync(topPick, "utf8").match(/const MOST_TOP = (\d+);/);
  expect(Number(found?.[1])).toBe(MOST_TOP);
});

test("a book of an edition is named the same on the page and the server", () => {
  for (const label of ["2-in-1", "3-in-1", "Deluxe", "Omnibus", "VIZBIG"])
    for (const number of [1, 12])
      expect(pageBookName(label, number)).toBe(bookName(label, number));
  expect(bookName("2-in-1", 1)).toBe("2-in-1 Book 1");
  expect(bookName("Deluxe", 3)).toBe("Deluxe 3");
});

test("an edition line's real books: the server's copy and the page's agree", () => {
  const book = (
    number: number,
    flags: { listed?: boolean; sure?: boolean },
  ) => ({
    number,
    volumes: [number * 3 - 2, number * 3 - 1, number * 3],
    ...flags,
  });
  const lines = [
    // listed 1, 2 and 5: the gap (3, 4) is real, the pattern past 5 isn't
    [
      book(1, { listed: true }),
      book(2, { listed: true }),
      book(3, {}),
      book(4, {}),
      book(5, { listed: true }),
      book(6, {}),
      book(7, {}),
    ],
    // vouched for without a catalog (the hand table, readers' reports)
    [book(1, { listed: true }), book(2, { sure: true }), book(3, {})],
    // nothing listed or vouched for: the whole line as worked out
    [book(1, {}), book(2, {})],
  ];
  for (const books of lines)
    expect(realBooks(books).map((b) => b.number)).toEqual(
      realBooksOf({ books }).map((b) => b.number),
    );
  expect(realBooks(lines[0]!).map((b) => b.number)).toEqual([1, 2, 3, 4, 5]);
});
