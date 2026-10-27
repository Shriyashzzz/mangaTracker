// Title matching decides which shop listings count as "this volume".
// A false match shows a wrong price, so these cases are worth pinning down
import {
  listingMatches,
  sameVolume,
  seriesName,
  slugify,
  volumeOf,
} from "../prices/match.js";

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
      listingMatches("Jujutsu Kaisen, Vol. 24 (24) Paperback - by Gege Akutami", book),
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
