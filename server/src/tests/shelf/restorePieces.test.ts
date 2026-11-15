// A Select's undo sends deleted series back in pieces the server takes
// (client lib/restorePieces.ts): the server reads at most 512 KB a request
import {
  restorable,
  restorePieces,
} from "../../../../client/src/lib/restorePieces.js";
import type { Manga } from "../../../../client/src/lib/types.js";

// a series with a book list as long as a big Goodreads import gives
const series = (n: number, books: number) =>
  ({
    id: n,
    name: `Series ${n}`,
    status: false,
    planned: false,
    lightNovel: false,
    bookmark: 0,
    byVolume: false,
    readVolume: null,
    edition: null,
    volumesOwned: books,
    ownedList: [],
    genre: null,
    description: null,
    image: null,
    rating: 0,
    books: Array.from({ length: books }, (_, i) => ({
      isbn13: `978${String(n * 1000 + i).padStart(10, "0")}`,
      edition: "single",
      number: i + 1,
      title: `Series ${n}, Vol. ${i + 1}`,
      volumes: [i + 1],
      paidCents: null,
      boughtOn: null,
    })),
  }) as unknown as Manga;

const bytes = (piece: Manga[]) =>
  Buffer.byteLength(JSON.stringify({ manga: piece.map(restorable) }));

test("a big undo goes back in pieces well under the server's limit", () => {
  const shelf = Array.from({ length: 250 }, (_, n) => series(n, 30));
  const pieces = restorePieces(shelf);
  expect(pieces.length).toBeGreaterThan(1);
  for (const piece of pieces) expect(bytes(piece)).toBeLessThan(512 * 1024);
  // every series once, in order
  expect(pieces.flat().map((m) => m.id)).toEqual(shelf.map((m) => m.id));
});

test("small series still go 200 at a time", () => {
  const shelf = Array.from({ length: 450 }, (_, n) => series(n, 0));
  expect(restorePieces(shelf).map((p) => p.length)).toEqual([200, 200, 50]);
});
