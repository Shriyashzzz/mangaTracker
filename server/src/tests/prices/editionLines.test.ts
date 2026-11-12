import { buildEditionLines } from "../../prices/editionLines.js";

const doc = (title: string, isbn13: string, pages?: number) => ({
  title,
  isbn13,
  pages,
});
let n = 0;
const isbn = () => `97815067${String(10000 + n++)}`;

test("a deluxe line from the hand-kept table: threes, and the last book ends with the series", () => {
  const docs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((b) =>
    doc(`Berserk Deluxe Volume ${b}`, isbn()),
  );
  const [line] = buildEditionLines(
    "Berserk",
    [
      ...docs,
      // bundles and print-on-demand copies borrow the name
      doc("Berserk Deluxe #1-14", "9781637994146"),
      doc("Berserk Deluxe vol 7-9", "9798897225408"),
      doc("Berserk Deluxe Edition Series 3 Books Collection", "9781637998991"),
      doc("Berserk Deluxe Volumes 10-14", "9781637993668"),
    ],
    41,
  );
  expect(line).toMatchObject({
    key: "deluxe",
    kind: "deluxe",
    label: "Deluxe",
  });
  expect(line!.books).toHaveLength(14);
  expect(line!.books[1]).toMatchObject({ number: 2, volumes: [4, 5, 6] });
  expect(line!.books[13]!.volumes).toEqual([40, 41]);
  expect(line!.books.every((b) => b.listed && b.isbn13)).toBe(true);
});

test("titles that say their volumes, and a book that doesn't sits between its neighbours", () => {
  const [line] = buildEditionLines(
    "Attack on Titan",
    [
      doc("Attack on Titan Omnibus 1 (Vol. 1-3)", isbn()),
      doc("Attack on Titan Omnibus 2 (Vol. 4-6)", isbn()),
      doc("Attack on Titan Omnibus 5 (Vol. 13-15)", isbn()),
      doc("Attack on Titan Omnibus 6", isbn()),
      doc("Attack on Titan Omnibus 7 (Vol. 19-21)", isbn()),
      doc("Attack on Titan Omnibus 12 (Vol. 33-34)", isbn()),
    ],
    34,
  );
  expect(line!.key).toBe("omnibus");
  expect(line!.books.map((b) => b.number)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  // 3 and 4 aren't in the catalog: worked out, and marked so
  expect(line!.books[2]).toMatchObject({
    volumes: [7, 8, 9],
    listed: false,
    isbn13: null,
  });
  expect(line!.books[5]).toMatchObject({ volumes: [16, 17, 18], listed: true });
  // the uneven last book keeps what it says
  expect(line!.books[11]!.volumes).toEqual([33, 34]);
});

test("a work titled with a bare range is that size's line", () => {
  const lines = buildEditionLines(
    "Naruto",
    [
      doc("Naruto #1-3", isbn()),
      doc("Naruto #4-6", isbn()),
      doc("Naruto #10-12", isbn()),
      doc("Naruto 01", isbn()),
      doc("Naruto Coloring Book", isbn()),
      // every volume in one listing isn't a book
      doc("Naruto #1-72", isbn()),
    ],
    72,
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ key: "3in1", label: "3-in-1" });
  expect(lines[0]!.books).toHaveLength(24);
  expect(lines[0]!.books[2]).toMatchObject({
    number: 3,
    volumes: [7, 8, 9],
    listed: false,
  });
});

test("one omnibus found, as long as three volumes: the line is threes", () => {
  const [line] = buildEditionLines(
    "One Piece",
    [
      doc("One Piece Omnibus 34", isbn(), 600),
      doc("One Piece: Ace's Story Omnibus 1", isbn(), 600),
      doc("ONE PIECE COLORWALK 1", isbn()),
    ],
    108,
  );
  expect(line!.books[33]).toMatchObject({
    number: 34,
    volumes: [100, 101, 102],
    listed: true,
  });
  expect(line!.books).toHaveLength(36);
});

test("two names for one line are one line", () => {
  const lines = buildEditionLines(
    "Bleach",
    [
      doc("Bleach (3-in-1 Edition), Vol. 1: Includes vols. 1, 2 & 3", isbn()),
      doc("Bleach (3-in-1 Edition), Vol. 2: Includes vols. 4, 5 & 6", isbn()),
      doc("Bleach Omnibus 3", isbn(), 580),
    ],
    74,
  );
  expect(lines).toHaveLength(1);
  expect(lines[0]!.books[2]).toMatchObject({ number: 3, listed: true });
});

test("nothing usable is no line, never a guess", () => {
  expect(
    buildEditionLines(
      "20th Century Boys",
      [doc("20th Century Boys", isbn()), doc("20th Century Boys", isbn())],
      22,
    ),
  ).toEqual([]);
  // another series whose name starts the same
  expect(
    buildEditionLines(
      "Monster",
      [doc("Monster High Deluxe Edition 1", isbn())],
      18,
    ),
  ).toEqual([]);
});
