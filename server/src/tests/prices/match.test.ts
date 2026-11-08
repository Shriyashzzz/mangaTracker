// Title matching decides which shop listings count as "this volume".
// A false match shows a wrong price, so these cases are worth pinning down
import {
  bookNumberOf,
  omnibusVolumes,
  listingMatches,
  sameVolume,
  seriesName,
  seriesOf,
  slugify,
  volumeOf,
} from "../../prices/stores/match.js";

describe("volumeOf", () => {
  test.each([
    ["Jujutsu Kaisen, Vol. 24", 24],
    ["One Piece, Volume 105", 105],
    ["That Time I Got Reincarnated as a Slime 21", 21],
  ])("%s -> %d", (title, n) => expect(volumeOf(title)).toBe(n));

  test("no number is NaN", () => expect(volumeOf("Akira")).toBeNaN());
});

describe("seriesName", () => {
  test("drops the volume and edition notes", () => {
    expect(seriesName("Jujutsu Kaisen, Vol. 24 (Shonen Jump)")).toBe(
      "Jujutsu Kaisen",
    );
  });
});

describe("listingMatches", () => {
  const book = "Jujutsu Kaisen, Vol. 24";

  test("a padded shop title still matches", () => {
    expect(
      listingMatches(
        "Jujutsu Kaisen, Vol. 24 (24) Paperback - by Gege Akutami",
        book,
      ),
    ).toBe(true);
  });
  test("a different volume does not", () => {
    expect(listingMatches("Jujutsu Kaisen, Vol. 23", book)).toBe(false);
  });
  test("box sets never count as one volume", () => {
    expect(listingMatches("Jujutsu Kaisen Box Set Vol. 24", book)).toBe(false);
    expect(listingMatches("Jujutsu Kaisen Vols 1-24", book)).toBe(false);
  });
  test("another series does not", () => {
    expect(listingMatches("Chainsaw Man, Vol. 24", book)).toBe(false);
  });
});

test("sameVolume compares series and number", () => {
  expect(sameVolume("Frieren, Vol. 3", "Frieren Vol. 3")).toBe(true);
  expect(sameVolume("Frieren, Vol. 3", "Frieren, Vol. 4")).toBe(false);
});

test("slugify makes URL-safe slugs", () => {
  expect(slugify("Frieren: Beyond Journey's End")).toBe(
    "frieren-beyond-journey-s-end",
  );
});

// "Vinland Saga, Book 9" holds vols 17 and 18: its number is the book's
test("a book holding several volumes keeps its series and its own number", () => {
  expect(bookNumberOf("Vinland Saga, Book 9")).toBe(9);
  expect(bookNumberOf("Vinland Saga, Vol. 9")).toBeNull();
  expect(bookNumberOf("The Book Thief 2")).toBeNull();
  expect(seriesName("Vinland Saga, Book 9")).toBe("Vinland Saga");
  expect(seriesOf("Vinland Saga, Book 9")).toBe("vinland saga");
  // a store lists it as "Vinland Saga 9": still matched by that number
  expect(volumeOf("Vinland Saga, Book 9")).toBe(9);
  // a shop listing must name it, as for any volume
  expect(listingMatches("Vinland Saga, Book 9", "Vinland Saga, Book 9")).toBe(
    true,
  );
  expect(listingMatches("Vinland Saga Vol. 9", "Vinland Saga, Book 9")).toBe(
    true,
  );
  expect(listingMatches("Vinland Saga, Book 8", "Vinland Saga, Book 9")).toBe(
    false,
  );
});

// an omnibus scanned onto the shelf brings every volume in it
test("an omnibus's volumes, from how its catalog title reads", () => {
  // Open Library's VIZ One Piece omnibus 1 (ISBN 9781421536255), 2026-11-07
  expect(
    omnibusVolumes(
      "One Piece, Vol. 1 (Romance Dawn / Buggy the Clown / Don't Get Fooled Again)",
    ),
  ).toEqual([1, 2, 3]);
  // omnibus 2 of three volumes each
  expect(omnibusVolumes("One Piece, Vol. 2 (A / B / C)")).toEqual([4, 5, 6]);
  expect(
    omnibusVolumes(
      "One Piece (Omnibus Edition), Vol. 4: Includes vols. 10, 11 & 12",
    ),
  ).toEqual([10, 11, 12]);
  expect(omnibusVolumes("Naruto (3-in-1 Edition), Vols. 1-3")).toEqual([
    1, 2, 3,
  ]);
  // can't tell which: nothing rather than a guess
  expect(omnibusVolumes("Fairy Tail Omnibus 2")).toEqual([]);
  // single volumes
  expect(omnibusVolumes("One Piece, Vol. 1")).toBeNull();
  expect(omnibusVolumes("Jujutsu Kaisen, Vol. 2 (Shonen Jump)")).toBeNull();
});
