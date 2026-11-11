// What a volume page is called: its stored title, or "Series, Vol. N" when
// that title has no volume number and the series list knows which it is
import { volumeHeading } from "../../prices/service.js";

test("a title without a number gets the series and the listed volume", () => {
  expect(
    volumeHeading("Dragon Ball Z; Thank You", "Dragon Ball Z", { volume: 24 }),
  ).toBe("Dragon Ball Z, Vol. 24");
});

test("a title with its number keeps it", () => {
  expect(volumeHeading("Naruto, Vol. 3", "Naruto", { volume: 3 })).toBe(
    "Naruto, Vol. 3",
  );
  // more than the series and a number: its own words stay
  expect(volumeHeading("Berserk Deluxe Edition 3", "Berserk", null)).toBe(
    "Berserk Deluxe Edition 3",
  );
});

test("nothing listed, or a book of several volumes, keeps the title", () => {
  expect(volumeHeading("Hellsing", "Hellsing", null)).toBe("Hellsing");
  expect(
    volumeHeading("Vinland Saga, Book Nine", "Vinland Saga", { volume: null }),
  ).toBe("Vinland Saga, Book Nine");
  expect(
    volumeHeading("Vinland Saga Deluxe", "Vinland Saga", {
      volume: 17,
      inBook: { label: "Book 9" },
    }),
  ).toBe("Vinland Saga Deluxe");
});

test("just the series and a number reads as Series, Vol. N", () => {
  expect(volumeHeading("ONE PIECE 28", "One Piece", { volume: 28 })).toBe(
    "One Piece, Vol. 28",
  );
  expect(volumeHeading("Berserk 12", "Berserk", null)).toBe("Berserk, Vol. 12");
  expect(volumeHeading("One Piece, Vol. 28", "One Piece", null)).toBe(
    "One Piece, Vol. 28",
  );
});
