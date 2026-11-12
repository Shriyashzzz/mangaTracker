import {
  bookLabel,
  booksFromCell,
  booksToCell,
  newBook,
} from "../../../../client/src/lib/books.js";

test("a book's edition comes from its title and what it holds", () => {
  expect(
    newBook("Berserk Deluxe Volume 2", [4, 5, 6], "9781506711997"),
  ).toEqual({
    isbn13: "9781506711997",
    edition: "deluxe",
    number: 2,
    title: "Berserk Deluxe Volume 2",
    volumes: [4, 5, 6],
  });
  expect(newBook("One Piece, Vol. 12", [12])).toMatchObject({
    edition: "single",
    number: 12,
    isbn13: null,
  });
  expect(
    newBook("Bleach (3-in-1 Edition), Vol. 21", [61, 62, 63]).edition,
  ).toBe("omnibus");
  expect(newBook("Naruto Box Set 1", [1, 2, 3]).edition).toBe("boxset");
  // not an ISBN-13: left out, never saved wrong
  expect(newBook("One Piece, Vol. 1", [1], "0123456789").isbn13).toBeNull();
});

test("a book reads as its edition and the volumes inside", () => {
  expect(bookLabel(newBook("Berserk Deluxe Volume 2", [4, 5, 6]))).toBe(
    "Deluxe 2 (vols. 4–6)",
  );
  expect(bookLabel(newBook("One Piece, Vol. 12", [12]))).toBe("Vol. 12");
});

test("a backup's Books cell reads back as written", () => {
  const books = [
    newBook("Berserk Deluxe Volume 2", [4, 5, 6], "9781506711997"),
    newBook("One Piece, Vol. 12", [12]),
  ];
  expect(booksFromCell(booksToCell(books))).toEqual(
    books.map((b) => ({ ...b, title: null })),
  );
  expect(booksFromCell("")).toEqual([]);
  expect(booksFromCell("nonsense; 123 single 1: 1")).toEqual([]);
});
