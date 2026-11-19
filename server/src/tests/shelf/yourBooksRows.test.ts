// The rows of "Your books" (client/src/pages/Details/yourBooksRows.ts):
// hand-ticked volumes read through the edition they collect
import {
  newBookOf,
  rowName,
  rowsOf,
  volumesOf,
} from "../../../../client/src/pages/Details/yourBooksRows.js";
import { slotsOf } from "../../../../client/src/lib/editionShelf.js";
import type { EditionLine } from "../../../../client/src/lib/editions.js";
import type { OwnedBook } from "../../../../client/src/lib/books.js";

const three = (book: number) => [book * 3 - 2, book * 3 - 1, book * 3];
// Vagabond's Definitive: six books of three, of 37 volumes
const line: EditionLine = {
  key: "definitive",
  kind: "deluxe",
  label: "Definitive",
  books: Array.from({ length: 6 }, (_, i) => ({
    number: i + 1,
    volumes: three(i + 1),
    isbn13: `978197475000${i}`,
    title: null,
    listed: true,
  })),
};
const collects = { line, slots: slotsOf(line, 37) };
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const names = (rows: ReturnType<typeof rowsOf>) => rows.map(rowName);

const definitive1 = {
  id: 1,
  edition: "deluxe",
  number: 1,
  title: "Definitive 1",
  label: "Definitive",
  isbn13: "9781974750000",
  volumes: [1, 2, 3],
  paidCents: 2973,
  boughtOn: "2026-11-17",
} as unknown as OwnedBook;

test("ticked volumes that fill a book of their edition are one row", () => {
  // the case that went wrong: Definitive 1 recorded, vols. 4 to 6 ticked
  const rows = rowsOf([definitive1], upTo(6), collects);
  expect(names(rows)).toEqual([
    "Definitive 2 (vols. 4–6)",
    "Definitive 1 (vols. 1–3)",
  ]);
  expect(volumesOf(rows[0]!)).toEqual([4, 5, 6]);
  // given a price it's saved as that book, with its ISBN
  expect(newBookOf(rows[0]!)).toMatchObject({
    edition: "deluxe",
    number: 2,
    isbn13: "9781974750001",
    volumes: [4, 5, 6],
  });
});

test("volumes that fill no book stay single rows", () => {
  // two of Definitive 2's three, and vol. 20, which it has no book for
  const rows = rowsOf([definitive1], [1, 2, 3, 4, 5, 20], collects);
  expect(names(rows)).toEqual([
    "Vol. 20",
    "Vol. 5",
    "Vol. 4",
    "Definitive 1 (vols. 1–3)",
  ]);
  expect(newBookOf(rows[0]!)).toMatchObject({ edition: "single", number: 20 });
});

test("collecting single volumes, every ticked volume is its own row", () => {
  expect(names(rowsOf([], [4, 5, 6]))).toEqual(["Vol. 6", "Vol. 5", "Vol. 4"]);
  expect(names(rowsOf([], [4, 5, 6], null))).toHaveLength(3);
});

test("a volume a recorded book holds isn't counted again", () => {
  // vol. 4 was priced as a single: Definitive 2 isn't claimed from 5 and 6
  const vol4 = {
    id: 2,
    edition: "single",
    number: 4,
    title: null,
    label: null,
    isbn13: null,
    volumes: [4],
    paidCents: 999,
    boughtOn: null,
  } as unknown as OwnedBook;
  const rows = rowsOf([definitive1, vol4], upTo(6), collects);
  expect(names(rows)).toEqual([
    "Vol. 6",
    "Vol. 5",
    "Vol. 4",
    "Definitive 1 (vols. 1–3)",
  ]);
});
