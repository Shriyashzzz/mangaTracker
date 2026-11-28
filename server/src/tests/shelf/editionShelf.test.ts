// A series' shelf seen through an edition (client/src/lib/editionShelf.ts):
// Vagabond's 37 volumes as 12 VIZBIG books and one volume left over.
import {
  isSingleSlot,
  ownedCaption,
  ownsEveryBook,
  placeInSlots,
  readPastTheBooks,
  runOf,
  shareOwned,
  slotName,
  slotOfVolume,
  slotsIn,
  slotsOf,
  slotsRead,
  spineOf,
  toggleSlot,
  volumeReadAfter,
  volumesAfterPaint,
} from "../../../../client/src/lib/editionShelf.js";
import type { EditionLine } from "../../../../client/src/lib/editions.js";

const three = (book: number) => [book * 3 - 2, book * 3 - 1, book * 3];
const lineOf = (books: number, label = "VIZBIG"): EditionLine => ({
  key: label.toLowerCase(),
  kind: "omnibus",
  label,
  books: Array.from({ length: books }, (_, i) => ({
    number: i + 1,
    volumes: three(i + 1),
    isbn13: null,
    title: null,
    listed: true,
  })),
});
const VIZBIG = lineOf(12);
const slots = slotsOf(VIZBIG, 37);
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("37 volumes as VIZBIG: twelve books, then vol. 37 on its own", () => {
  expect(slots).toHaveLength(13);
  expect(slots[0]!.volumes).toEqual([1, 2, 3]);
  expect(slots[11]!.volumes).toEqual([34, 35, 36]);
  expect(slots[12]).toEqual({ volumes: [37], book: null });
  expect(slots.map(spineOf).slice(-2)).toEqual(["12", "37"]);
});

test("a book the line only worked out, past the last one listed, isn't one", () => {
  // as Vagabond's line is saved: twelve listed, and a 13th worked out for
  // vol. 37 that was never printed
  const saved = lineOf(12);
  saved.books.push({
    number: 13,
    volumes: [37],
    isbn13: null,
    title: null,
    listed: false,
  });
  const shelf = slotsOf(saved, 37);
  expect(shelf).toHaveLength(13);
  expect(shelf[12]).toEqual({ volumes: [37], book: null });
  // one worked out between listed books is real: the catalog just lacks it
  const hole = lineOf(12);
  hole.books[5]!.listed = false;
  expect(slotsOf(hole, 36).every((slot) => slot.book)).toBe(true);
});

test("a book that isn't out yet is left off", () => {
  // 13 books worked out for a series with 30 volumes out: 10 are real
  expect(slotsOf(lineOf(13), 30)).toHaveLength(10);
  // a book partly out is on the shelf: vols 31 and 32 are, 33 isn't
  expect(slotsOf(lineOf(13), 32)).toHaveLength(11);
});

test("whole books, part of a book, and none", () => {
  // four books, and vol. 13 bought as a single
  const owned = [...upTo(12), 13];
  expect(slotsIn(slots, owned, "all")).toEqual([1, 2, 3, 4]);
  expect(slotsIn(slots, owned, "part")).toEqual([5]);
  expect(shareOwned(slots, owned, 5)).toBeCloseTo(1 / 3);
  expect(shareOwned(slots, owned, 6)).toBe(0);
});

test("tapping a book owns all of it, or none of it", () => {
  expect(toggleSlot(slots[1]!, [1, 2, 3])).toEqual([1, 2, 3, 4, 5, 6]);
  expect(toggleSlot(slots[1]!, upTo(6))).toEqual([1, 2, 3]);
  // the volume on its own
  expect(toggleSlot(slots[12]!, [1])).toEqual([1, 37]);
});

test("a slide owns what it passes, but never completes a part-owned book", () => {
  const owned = [1, 2, 3, 13, 10.5];
  // slid from book 2 to book 6
  const after = volumesAfterPaint(slots, owned, [1, 2, 3, 4, 5, 6]);
  expect(after).toEqual(
    [...upTo(12), 10.5, 13, 16, 17, 18].sort((a, b) => a - b),
  );
  // book 5 still has only vol. 13; the half volume is kept
  expect(after).not.toContain(14);
  expect(after).toContain(10.5);
  // sliding back off everything: the part stays, the whole books go
  expect(volumesAfterPaint(slots, owned, [])).toEqual([10.5, 13]);
});

test("their place, counted in books", () => {
  expect(slotOfVolume(slots, 5)).toBe(2);
  expect(slotOfVolume(slots, 37)).toBe(13);
  expect(slotOfVolume(slots, 38)).toBeNull();
  // read up to vol. 12 is four books; vol. 11 is still three
  expect(slotsRead(slots, 12)).toBe(4);
  expect(slotsRead(slots, 11)).toBe(3);
  expect(slotsRead(slots, null)).toBe(0);
  // and the counter saves the book's last volume
  expect(volumeReadAfter(slots, 4)).toBe(12);
  expect(volumeReadAfter(slots, 13)).toBe(37);
  expect(volumeReadAfter(slots, 0)).toBe(0);
});

test("the caption's place: read up to a book, or partway through one", () => {
  const read = (volume: number) =>
    placeInSlots(slots, { volume, kind: "read up to" });
  expect(read(12)).toEqual({ slot: 4, text: "Read up to book 4" });
  expect(read(5)).toEqual({ slot: 2, text: "Reading book 2" });
  expect(read(37)).toEqual({ slot: 13, text: "Read up to vol. 37" });
  expect(placeInSlots(slots, { volume: 12, kind: "reading" })?.text).toBe(
    "Reading book 4",
  );
  expect(placeInSlots(slots, null)).toBeNull();
});

test("the caption's count, and the leftover volumes only once they're theirs", () => {
  expect(ownedCaption(slots, upTo(12))).toBe("You own 4 of 12");
  // never "sold singly": an edition still coming out has more books on the way
  expect(ownedCaption(slots, upTo(36))).toBe("All 12 yours");
  expect(ownedCaption(slots, upTo(37))).toBe("All 12 yours, and vol. 37");
  // an edition that covers the whole series
  expect(ownedCaption(slotsOf(VIZBIG, 36), upTo(36))).toBe("All 12 yours");
  // two volumes left over, not theirs
  expect(ownedCaption(slotsOf(VIZBIG, 38), upTo(36))).toBe("All 12 yours");
});

test("every book theirs, or not", () => {
  expect(ownsEveryBook(slots, upTo(12))).toBe(false);
  expect(ownsEveryBook(slots, upTo(36))).toBe(true);
});

test("a slot by name, for hovering", () => {
  expect(slotName(VIZBIG, slots[1]!)).toBe("VIZBIG 2, vols. 4–6");
  expect(slotName(VIZBIG, slots[4]!, [13])).toBe(
    "VIZBIG 5: you have vol. 13 of 13–15",
  );
  expect(slotName(VIZBIG, slots[12]!)).toBe("Vol. 37, single volume");
});

test("reading past an edition's last book is said in volumes", () => {
  // six Definitive books out (vols. 1 to 18) of a series with 37
  const six = slotsOf(lineOf(6, "Definitive"), 37);
  expect(readPastTheBooks(six, 18)).toBe(false);
  expect(readPastTheBooks(six, 19)).toBe(true);
  expect(readPastTheBooks(six, null)).toBe(false);
  // no books at all: nothing to be past
  expect(readPastTheBooks(slotsOf(lineOf(0), 5), 3)).toBe(false);
});

test("a book with a day still to come isn't on the shelf yet", () => {
  const line = lineOf(3);
  line.books[2]!.published = "2999-01-01";
  // book 3's volumes are out as singles: they show as those
  const shelf = slotsOf(line, 9, "2026-11-19");
  expect(shelf.map((slot) => slot.volumes)).toEqual([
    [1, 2, 3],
    [4, 5, 6],
    [7],
    [8],
    [9],
  ]);
  // out by then, or no day said: a book like any other
  expect(slotsOf(line, 9, "2999-06-01")).toHaveLength(3);
  expect(slotsOf(line, 9)).toHaveLength(3);
});

// Vagabond seen as Definitive (six books, vols. 1-18) by someone with
// Definitive 1-4 and VIZBIG 5-10, as the server sends their books
describe("their own books where the edition has none", () => {
  const definitive = lineOf(6, "Definitive");
  const mine = (label: string, number: number, edition = "omnibus") => ({
    label,
    edition,
    number,
    volumes: three(number),
  });
  const recorded = [
    ...[1, 2, 3, 4].map((n) => mine("Definitive", n, "deluxe")),
    ...[5, 6, 7, 8, 9, 10].map((n) => mine("VIZBIG", n)),
  ];
  const shelf = slotsOf(definitive, 37, undefined, recorded);
  const owned = upTo(30);

  test("VIZBIG 7 to 10 stand as books, not as twelve singles", () => {
    // six Definitive, four VIZBIG, then vols. 31-37
    expect(shelf).toHaveLength(17);
    expect(shelf[6]!.volumes).toEqual([19, 20, 21]);
    expect(shelf.slice(6, 10).map(spineOf)).toEqual(["7", "8", "9", "10"]);
    expect(isSingleSlot(shelf[6]!)).toBe(false);
    expect(isSingleSlot(shelf[10]!)).toBe(true);
    expect(slotName(definitive, shelf[6]!, owned)).toBe(
      "VIZBIG 7, vols. 19–21",
    );
    expect(runOf(shelf[6]!, definitive, recorded)).toEqual({
      label: "VIZBIG",
      kind: "omnibus",
    });
    expect(runOf(shelf[10]!, definitive, recorded).label).toBe("Singles");
  });

  test("where the edition has the book, the shelf keeps it", () => {
    // VIZBIG 5 and 6 hold what Definitive 5 and 6 do: the edition's books,
    // named by what they really are
    expect(shelf[4]!.book?.number).toBe(5);
    expect(runOf(shelf[4]!, definitive, recorded).label).toBe("VIZBIG");
    expect(ownedCaption(shelf, owned)).toBe("All 6 yours");
  });

  test("ticking one off takes its three volumes", () => {
    expect(toggleSlot(shelf[6]!, owned)).toEqual(
      owned.filter((v) => ![19, 20, 21].includes(v)),
    );
  });

  test("a single volume, a box set, or a book past what's out isn't one", () => {
    const others = [
      { label: null, edition: "single", number: 19, volumes: [19] },
      { label: "Box set", edition: "boxset", number: 1, volumes: [19, 20, 21] },
      mine("VIZBIG", 13),
    ];
    const plain = slotsOf(definitive, 37, undefined, others);
    expect(plain).toHaveLength(6 + 19);
    expect(plain.slice(6).every(isSingleSlot)).toBe(true);
  });
});
