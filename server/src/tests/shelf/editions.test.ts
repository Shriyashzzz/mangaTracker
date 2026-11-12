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
