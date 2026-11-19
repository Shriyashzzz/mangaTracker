// Where a reader is in the edition they collect, as a shelf card says it
// (util/shelf/editionPlace.ts)
import { editionPlaceOf } from "../../util/shelf/editionPlace.js";

const three = (book: number) => [book * 3 - 2, book * 3 - 1, book * 3];
// Vagabond's twelve VIZBIGs: vols. 1 to 36
const VIZBIG = {
  label: "VIZBIG",
  books: Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    volumes: three(i + 1),
  })),
};
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("the book their read volume is in", () => {
  expect(editionPlaceOf(VIZBIG, 12, []).read).toBe(4);
  // partway through a book is still that book
  expect(editionPlaceOf(VIZBIG, 5, []).read).toBe(2);
  expect(editionPlaceOf(VIZBIG, null, []).read).toBeNull();
  // vol. 37 is in no VIZBIG: the card says "vol. 37"
  expect(editionPlaceOf(VIZBIG, 37, []).read).toBeNull();
});

test("the books they own, only when every volume is in a whole book", () => {
  expect(editionPlaceOf(VIZBIG, null, upTo(12)).owned).toEqual([1, 2, 3, 4]);
  // books 1 and 3, not 2
  expect(editionPlaceOf(VIZBIG, null, [1, 2, 3, 7, 8, 9]).owned).toEqual([
    1, 3,
  ]);
  // one volume of book 5 bought on its own: said in volumes instead
  expect(editionPlaceOf(VIZBIG, null, [...upTo(12), 13]).owned).toBeNull();
  // every VIZBIG and vol. 37
  expect(editionPlaceOf(VIZBIG, null, upTo(37)).owned).toBeNull();
  expect(editionPlaceOf(VIZBIG, null, []).owned).toBeNull();
});

test("a book the line only worked out past its last listed one isn't one", () => {
  // Vagabond's line as it's saved: a 13th VIZBIG worked out for vol. 37
  const saved = {
    label: "VIZBIG",
    books: [
      ...VIZBIG.books.map((book) => ({ ...book, listed: true })),
      { number: 13, volumes: [37], listed: false },
    ],
  };
  expect(editionPlaceOf(saved, 37, []).read).toBeNull();
  expect(editionPlaceOf(saved, 36, upTo(36)).read).toBe(12);
  // owning vol. 37 too is said in volumes, not as a 13th book
  expect(editionPlaceOf(saved, null, upTo(37)).owned).toBeNull();
});

test("for the New tab: the next book, how many behind, and how far they are", () => {
  // owns VIZBIG 1 to 4 of 12
  const four = editionPlaceOf(VIZBIG, null, upTo(12));
  expect([four.next, four.behind, four.upTo]).toEqual([5, 8, 4]);
  // reads them without owning any: read up to vol. 12 is the same place
  const read = editionPlaceOf(VIZBIG, 12, []);
  expect([read.next, read.behind, read.upTo]).toEqual([5, 8, 4]);
  // a gap behind their furthest counts, and the next is past the furthest
  const gap = editionPlaceOf(VIZBIG, null, [1, 2, 3, 7, 8, 9]);
  expect([gap.next, gap.behind, gap.upTo]).toEqual([4, 10, 3]);
  // every book: nothing next, none behind
  const all = editionPlaceOf(VIZBIG, null, upTo(36));
  expect([all.next, all.behind, all.upTo]).toEqual([null, 0, 12]);
  // none yet
  const none = editionPlaceOf(VIZBIG, null, []);
  expect([none.next, none.behind, none.upTo]).toEqual([1, 12, null]);
});

test("a book that isn't out yet isn't one they're behind on", () => {
  const line = {
    label: "VIZBIG",
    books: [
      { number: 1, volumes: [1, 2, 3], listed: true, published: "2020-01-07" },
      { number: 2, volumes: [4, 5, 6], listed: true, published: "2020-04-07" },
      { number: 3, volumes: [7, 8, 9], listed: true, published: "2999-01-01" },
    ],
  };
  // owns book 1: one behind (book 2), and book 3 is still to come
  const one = editionPlaceOf(line, null, [1, 2, 3], "2026-11-19");
  expect([one.next, one.behind]).toEqual([2, 1]);
  // owns both that are out: none behind, and the next is the one coming
  const both = editionPlaceOf(line, null, upTo(6), "2026-11-19");
  expect([both.next, both.behind, both.nextPublished]).toEqual([
    3,
    0,
    "2999-01-01",
  ]);
});
