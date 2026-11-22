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
  // (series the hand table has no finished edition for: one it has gets
  // its line from the table, whatever the catalogs say)
  expect(
    buildEditionLines(
      "Dorohedoro",
      [doc("Dorohedoro", isbn()), doc("Dorohedoro", isbn())],
      23,
    ),
  ).toEqual([]);
  // another series whose name starts the same
  expect(
    buildEditionLines(
      "Pluto",
      [doc("Pluto Water Deluxe Edition 1", isbn())],
      8,
    ),
  ).toEqual([]);
});

// ---------- Google's records, and the hand table as a source ----------
const dated = (title: string, isbn13: string, published: string) => ({
  title,
  isbn13,
  published,
});

test("a number straight after the edition's words, and the day a book came out", () => {
  // as Google has Fruits Basket's Collector's Edition
  const lines = buildEditionLines(
    "Fruits Basket",
    [
      dated("Fruits Basket Collector's Edition 01", isbn(), "2016-06-28"),
      dated("Fruits Basket Collector's Edition 02", isbn(), "2016-07-26"),
    ],
    23,
  );
  const line = lines.find((l) => l.key === "collectors")!;
  expect(line.books[0]).toMatchObject({
    number: 1,
    volumes: [1, 2],
    published: "2016-06-28",
  });
  // the table knows all twelve, the last holding one volume
  expect(line.books).toHaveLength(12);
  expect(line.books[11]!.volumes).toEqual([23]);
});

test("a finished edition in the table is whole, whatever the catalogs list", () => {
  // the catalogs have 21 of Naruto's 24: all 24 are in print
  const found = [1, 2, 3].map((n) =>
    doc(`Naruto (3-in-1 Edition), Vol. ${n}`, isbn(), 600),
  );
  const [line] = buildEditionLines("Naruto", found, 72);
  expect(line!.books).toHaveLength(24);
  expect(line!.books.every((book) => book.sure)).toBe(true);
  expect(line!.books[23]).toMatchObject({
    volumes: [70, 71, 72],
    listed: false,
  });
  expect(line!.books[0]!.listed).toBe(true);
  // and with nothing found at all, the table's line is still there
  const [alone] = buildEditionLines("Naruto", [], 72);
  expect(alone).toMatchObject({ key: "3in1", label: "3-in-1" });
  expect(alone!.books).toHaveLength(24);
});

test("an edition still coming out is never vouched for", () => {
  // Vagabond's Definitive: 13 planned, the catalogs list what's out
  const found = [1, 2].map((n) =>
    doc(`Vagabond Definitive Edition, Vol. ${n}`, isbn()),
  );
  const line = buildEditionLines("Vagabond", found, 37).find(
    (l) => l.key === "definitive",
  )!;
  expect(line.books.some((book) => book.sure)).toBe(false);
  // nothing found: no line is made up for it
  expect(buildEditionLines("Vagabond", [], 37)).toEqual([]);
});

test("two editions that start with the same volumes both stay", () => {
  const lines = buildEditionLines(
    "Vagabond",
    [
      doc("Vagabond (VIZBIG Edition), Vol. 1", isbn()),
      doc("Vagabond (VIZBIG Edition), Vol. 2", isbn()),
      doc("Vagabond Definitive Edition, Vol. 1", isbn()),
      doc("Vagabond Definitive Edition, Vol. 2", isbn()),
    ],
    37,
  );
  expect(lines.map((l) => l.key).sort()).toEqual(["definitive", "vizbig"]);
});

test("books a catalog filed as a 2-in-1 are the table's Black Edition", () => {
  // Open Library titles them "Death Note #1-2"
  const lines = buildEditionLines(
    "Death Note",
    [doc("Death Note #1-2", isbn()), doc("Death Note #3-4", isbn())],
    12,
  );
  expect(lines.map((l) => l.label)).toEqual(["Black Edition"]);
  expect(lines[0]!.books).toHaveLength(6);
  // and they keep their ISBNs
  expect(lines[0]!.books[0]!.listed).toBe(true);
  expect(lines[0]!.books[5]).toMatchObject({ volumes: [11, 12], sure: true });
});

test("a short last book sold under another name is that edition's last book", () => {
  // VIZ calls Bleach's 25th 3-in-1 a "2-in-1 Edition"
  const lines = buildEditionLines(
    "Bleach",
    [
      doc("Bleach (3-in-1 Edition), Vol. 1: Includes vols. 1, 2 & 3", isbn()),
      doc("Bleach (3-in-1 Edition), Vol. 2: Includes vols. 4, 5 & 6", isbn()),
      doc("Bleach (2-in-1 Edition), Vol. 25: Includes vols. 73 & 74", isbn()),
    ],
    74,
  );
  expect(lines.map((l) => l.key)).toEqual(["3in1"]);
  expect(lines[0]!.books).toHaveLength(25);
  expect(lines[0]!.books[24]).toMatchObject({
    volumes: [73, 74],
    listed: true,
  });
});

test("the table caps an edition at the books it has", () => {
  // a catalog's stray record for a twelfth Ultimate Edition: there are six
  const lines = buildEditionLines(
    "Fruits Basket",
    [1, 2, 12].map((n) =>
      doc(`Fruits Basket Ultimate Edition Volume ${n}`, isbn()),
    ),
    23,
  );
  const ultimate = lines.find((l) => l.key === "ultimate")!;
  expect(ultimate.books).toHaveLength(6);
  expect(ultimate.books[5]!.volumes).toEqual([11, 12]);
});

test("two editions of the table's that start alike are both kept", () => {
  // Rurouni Kenshin's 3-in-1 and its VIZBIG: nine books each, 1 to 3 first
  const lines = buildEditionLines("Rurouni Kenshin", [], 28);
  expect(lines.map((l) => l.key).sort()).toEqual(["3in1", "vizbig"]);
  // the ninth of each holds the last four
  for (const line of lines)
    expect(line.books[8]!.volumes).toEqual([25, 26, 27, 28]);
});

const store = (title: string, isbn13: string) => ({
  title,
  isbn13,
  fromStore: true,
});

test("a book with the newer 979-8 ISBN is a publisher's book too", () => {
  // Seven Seas' later Tokyo Revengers omnibuses, as a store lists them
  const lines = buildEditionLines(
    "Tokyo Revengers",
    [
      doc("Tokyo Revengers (Omnibus) Vol. 1-2", "9781638585718"),
      store("Tokyo Revengers (Omnibus) Vol. 23-24", "9798888438626"),
      store("Tokyo Revengers (Omnibus) Vol. 29-31", "9798891604858"),
    ],
    31,
  );
  const [line] = lines;
  expect(line!.books).toHaveLength(15);
  expect(line!.books[11]).toMatchObject({ volumes: [23, 24], listed: true });
  // the last holds three, and is the fifteenth
  expect(line!.books[14]).toMatchObject({
    volumes: [29, 30, 31],
    isbn13: "9798891604858",
    listed: true,
  });
});

test("a 979-8 book nobody vouches for is not taken", () => {
  // the prefix print-on-demand bundles share: no store, no known publisher
  const lines = buildEditionLines(
    "Hellsing",
    [
      doc("Hellsing Deluxe Volume 1", "9798888888881"),
      doc("Hellsing Deluxe Volume 2", "9798888888882"),
    ],
    10,
  );
  // the table's line is there, but neither book is "listed" from these
  expect(lines[0]!.books.some((book) => book.listed)).toBe(false);
  // with a manga publisher's name on it, it is
  const named = buildEditionLines(
    "Hellsing",
    [
      {
        title: "Hellsing Deluxe Volume 1",
        isbn13: "9798888888881",
        publishers: ["Dark Horse Comics"],
      },
    ],
    10,
  );
  expect(named[0]!.books[0]!.listed).toBe(true);
});

test("past the last book found, no partial book is guessed: Vagabond has 12 VIZBIGs and vol. 37 alone", () => {
  const docs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((b) =>
    doc(`Vagabond VIZBIG Edition, Vol. ${b}`, isbn()),
  );
  const [line] = buildEditionLines("Vagabond", docs, 37);
  expect(line!.books).toHaveLength(12);
  expect(line!.books.at(-1)).toMatchObject({
    number: 12,
    volumes: [34, 35, 36],
    listed: true,
  });
});

test("past the last book found, full books are still worked out, and a short last one is not", () => {
  // a made-up series, so the hand-kept table has nothing to say
  const [line] = buildEditionLines(
    "Harbor Lights",
    [
      doc(
        "Harbor Lights (3-in-1 Edition), Vol. 1: Includes vols. 1, 2 & 3",
        isbn(),
      ),
      doc(
        "Harbor Lights (3-in-1 Edition), Vol. 2: Includes vols. 4, 5 & 6",
        isbn(),
      ),
    ],
    74,
  );
  // 24 books of three reach 72: book 25 would hold only 73 and 74
  expect(line!.books).toHaveLength(24);
  expect(line!.books.at(-1)).toMatchObject({
    number: 24,
    volumes: [70, 71, 72],
    listed: false,
  });
});

test("a short last book the catalog lists stays", () => {
  const docs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((b) =>
    doc(`Vagabond VIZBIG Edition, Vol. ${b}`, isbn()),
  );
  const [line] = buildEditionLines("Vagabond", docs, 37);
  expect(line!.books).toHaveLength(13);
  expect(line!.books.at(-1)).toMatchObject({ volumes: [37], listed: true });
});

test("several of a line's books sold together are never one of its books", () => {
  // every Deluxe book but the eleventh, and a bundle of the first eleven
  const real = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14].map((b) =>
    doc(`Berserk Deluxe Volume ${b}`, isbn()),
  );
  const bundle = doc("Berserk Deluxe Books 1-11", "9781338727807");
  const [line] = buildEditionLines("Berserk", [...real, bundle], 41);
  const eleventh = line!.books.find((b) => b.number === 11);
  // the eleventh is known of (the table has it) but has no book of its own
  expect(eleventh?.isbn13 ?? null).toBeNull();
  expect(line!.books.some((b) => b.isbn13 === bundle.isbn13)).toBe(false);
  // with the real one found too, it's the real one
  const eleven = doc("Berserk Deluxe Volume 11", "9781506727554");
  const [whole] = buildEditionLines("Berserk", [...real, bundle, eleven], 41);
  expect(whole!.books.find((b) => b.number === 11)).toMatchObject({
    isbn13: eleven.isbn13,
    listed: true,
  });
});
