import {
  editionPlan,
  guessEdition,
  type EditionLine,
} from "../../../../client/src/lib/editions.js";

// threes from vol. 1; the last `unlisted` books aren't in the catalog
const line = (books: number, unlisted = 0, key = "deluxe"): EditionLine => ({
  key,
  kind: key === "deluxe" ? "deluxe" : "omnibus",
  label: "Deluxe",
  books: Array.from({ length: books }, (_, i) => ({
    number: i + 1,
    volumes: [i * 3 + 1, i * 3 + 2, i * 3 + 3],
    isbn13: i < books - unlisted ? `978150671${String(1000 + i)}` : null,
    title: null,
    listed: i < books - unlisted,
    knownPriceCents: i % 2 ? null : 3000,
  })),
});
const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

test("the next book is the one after the furthest they own, counted in books", () => {
  const plan = editionPlan(line(14), run(1, 6));
  expect(plan.next).toMatchObject({ number: 3, volumes: [7, 8, 9], have: 0 });
  expect(plan.gaps).toEqual([]);
  expect(plan.ownedBooks).toBe(2);
  // twelve books, never thirty-six paperbacks
  expect(plan.left).toHaveLength(12);
});

test("owning nothing starts at book 1; owning it all is caught up", () => {
  expect(editionPlan(line(4), []).next?.number).toBe(1);
  const done = editionPlan(line(4), run(1, 12));
  expect(done.next).toBeNull();
  expect(done.caughtUp).toBe(true);
  expect(done.left).toEqual([]);
});

test("a book they own some volumes of is still to get, and says how many they have", () => {
  // singles 1-7: Deluxe 3 holds 7-9, and they have one of its three
  const plan = editionPlan(line(5), run(1, 7));
  expect(plan.next).toMatchObject({ number: 3, have: 1 });
  expect(plan.gaps).toEqual([]);
  expect(plan.ownedBooks).toBe(2);
});

test("a book skipped behind the furthest is a gap", () => {
  const plan = editionPlan(line(5), [...run(1, 3), ...run(7, 9)]);
  expect(plan.gaps.map((b) => b.number)).toEqual([2]);
  expect(plan.next?.number).toBe(4);
});

test("books past the last one listed aren't counted as out", () => {
  const plan = editionPlan(line(6, 2), run(1, 12));
  expect(plan.caughtUp).toBe(true);
  expect(plan.next).toBeNull();
  expect(plan.later).toBe(2);
  expect(plan.outBooks).toBe(4);
});

test("halves and specials don't make a book owned", () => {
  const plan = editionPlan(line(2), [0, 1, 2, 2.5]);
  expect(plan.ownedBooks).toBe(0);
  expect(plan.next).toMatchObject({ number: 1, have: 2 });
});

test("the cost counts stored prices only", () => {
  const plan = editionPlan(line(4), run(1, 3));
  // books 2, 3, 4 left; only book 3 (index 2) has a price
  expect(plan.left).toHaveLength(3);
  expect(plan.pricedCount).toBe(1);
  expect(plan.pricedCents).toBe(3000);
});

test("the edition is guessed from their recorded books, never from ticks alone", () => {
  const lines = [line(14), { ...line(14, 0, "3in1"), label: "3-in-1" }];
  const deluxe = (n: number) => ({
    edition: "deluxe" as const,
    volumes: [n * 3 - 2, n * 3 - 1, n * 3],
  });
  // two deluxe books cover all six they own
  expect(guessEdition(lines, [deluxe(1), deluxe(2)], run(1, 6))).toBe("deluxe");
  // ticked by hand: no books, no guess
  expect(guessEdition(lines, [], run(1, 6))).toBeNull();
  // one deluxe among thirty singles isn't what they collect
  expect(guessEdition(lines, [deluxe(1)], run(1, 30))).toBeNull();
  // singles never point to a line
  expect(
    guessEdition(lines, [{ edition: "single", volumes: [1] }], [1]),
  ).toBeNull();
  expect(guessEdition([], [deluxe(1)], run(1, 3))).toBeNull();
});

// ---------- the shelf's cost to finish, in an edition's books ----------
import { finishEdition } from "../../collector/shelfMath.js";

const copy = (cents: number) => ({
  new: { cents, store: "Shop", url: null } as never,
  used: null,
});

test("finishing an edition counts its books, each once, and estimates the unpriced", () => {
  const deluxe = line(5, 1);
  const copies = new Map([
    [deluxe.books[2]!.isbn13!, copy(4000)],
    [deluxe.books[3]!.isbn13!, copy(5000)],
  ]);
  // they own 1-7: books 1 and 2 whole, one volume of book 3
  const f = finishEdition(
    { volumesOwned: 7, ownedList: [] },
    deluxe,
    copies,
    1200,
  );
  // book 5 isn't listed: not counted as out
  expect(f.missing.map((m) => m.label)).toEqual(["Deluxe 3", "Deluxe 4"]);
  expect(f.missing[0]).toMatchObject({ volume: 3, inside: [7, 8, 9] });
  expect(f.cents).toBe(9000);
  expect(f.priced).toBe(2);
  // two of the four books out are priced: too few to say a total
  expect(f.estimateCents).toBeNull();
  // a third one priced is enough (3 of 4)
  copies.set(deluxe.books[0]!.isbn13!, copy(4500));
  expect(
    finishEdition({ volumesOwned: 7, ownedList: [] }, deluxe, copies, 1200)
      .estimateCents,
  ).toBe(9000);
});

test("an edition with nothing priced has a count and no total", () => {
  const f = finishEdition(
    { volumesOwned: 3, ownedList: [] },
    line(3),
    new Map(),
    1000,
  );
  expect(f.missing).toHaveLength(2);
  expect(f.cents).toBe(0);
  expect(f.estimateCents).toBeNull();
});

// ---------- asking for an edition by name ----------
import { askedEdition, lineFor } from "../../../../client/src/lib/editions.js";

test("a search naming an edition is the series and that edition", () => {
  expect(askedEdition("berserk deluxe")).toEqual({
    series: "berserk",
    edition: "deluxe",
  });
  expect(askedEdition("Naruto 3-in-1 edition")).toEqual({
    series: "Naruto",
    edition: "3in1",
  });
  expect(askedEdition("one piece omnibus")).toMatchObject({
    series: "one piece",
    edition: "omnibus",
  });
  // names that only look like one are left alone
  expect(askedEdition("Fullmetal Alchemist").edition).toBeNull();
  expect(askedEdition("Master Keaton").edition).toBeNull();
  // the word alone isn't a series
  expect(askedEdition("omnibus")).toEqual({ series: "omnibus", edition: null });
});

test("an asked-for edition finds its line, or one of its kind", () => {
  const lines = [line(3), { ...line(3, 0, "3in1"), label: "3-in-1" }];
  expect(lineFor(lines, "deluxe")?.key).toBe("deluxe");
  // "omnibus" means the series' 3-in-1 books when that's what it has
  expect(lineFor(lines, "omnibus")?.key).toBe("3in1");
  expect(lineFor(lines, null)).toBeNull();
  expect(lineFor([line(3)], "omnibus")).toBeNull();
});
