import {
  centsOf,
  spentOn,
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
  // an edition's book keeps its title; a single's is only its number
  expect(booksFromCell(booksToCell(books))).toEqual(
    books.map((b) => (b.edition === "single" ? { ...b, title: null } : b)),
  );
  expect(booksFromCell("")).toEqual([]);
  expect(booksFromCell("nonsense; 123 single 1: 1")).toEqual([]);
});

test("what was paid and the day bought ride along in the backup", () => {
  const book = {
    ...newBook("Berserk Deluxe Volume 2", [4, 5, 6], "9781506711997"),
    title: null,
    paidCents: 4999,
    boughtOn: "2026-01-05T00:00:00.000Z",
  };
  const cell = booksToCell([book, newBook("One Piece, Vol. 12", [12])]);
  expect(cell).toBe(
    "9781506711997 deluxe 2: 4–6 @49.99 2026-01-05; - single 12: 12",
  );
  expect(booksFromCell(cell)[0]).toEqual({ ...book, boughtOn: "2026-01-05" });
  // a price with no day, and a backup from before either was kept
  expect(booksFromCell("- single 3: 3 @7")[0]).toMatchObject({
    paidCents: 700,
  });
  expect(booksFromCell("- single 3: 3")[0]).not.toHaveProperty("paidCents");
});

test("a typed price is cents, and nonsense is nothing", () => {
  expect(centsOf("12.99")).toBe(1299);
  expect(centsOf("$1,049.5")).toBe(104950);
  expect(centsOf("0")).toBe(0);
  expect(centsOf("")).toBeNull();
  expect(centsOf("ten")).toBeNull();
  expect(centsOf("-5")).toBeNull();
  expect(spentOn([{ paidCents: 500 }, { paidCents: null }, {}])).toEqual({
    cents: 500,
    books: 1,
  });
});

test("an edition's book keeps its own title through the backup; older cells still read", () => {
  const perfect = {
    isbn13: "9781974700127",
    edition: "deluxe" as const,
    number: 1,
    title: "20th Century Boys Perfect Edition #1",
    volumes: [1, 2],
  };
  const single = {
    isbn13: null,
    edition: "single" as const,
    number: 12,
    title: "Vol. 12",
    volumes: [12],
  };
  const cell = booksToCell([perfect, single]);
  expect(cell).toBe(
    "9781974700127 deluxe 1 [20th Century Boys Perfect Edition #1]: 1–2; - single 12: 12",
  );
  const [back, backSingle] = booksFromCell(cell);
  expect(back).toMatchObject(perfect);
  expect(backSingle).toMatchObject({
    edition: "single",
    number: 12,
    title: null,
  });
  // a file from before titles were written
  expect(booksFromCell("9781974700127 deluxe 1: 1–2")[0]).toMatchObject({
    edition: "deluxe",
    number: 1,
    title: null,
    volumes: [1, 2],
  });
});

// a mistyped ISBN (its check digit wrong) is not one: dropped, the book kept
test("isbn13Ok checks the last digit", async () => {
  const { isbn13Ok } = await import("../../prices/sources/catalog.js");
  expect(isbn13Ok("9781974725762")).toBe(true);
  expect(isbn13Ok("9781974725763")).toBe(false);
  expect(isbn13Ok("hello")).toBe(false);
  expect(isbn13Ok(null)).toBe(false);
});
