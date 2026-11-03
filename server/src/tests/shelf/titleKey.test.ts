import { isOnShelf, titleKey } from "../../util/shelf/titleKey.js";

const shelf = [
  { id: 1, name: "One Piece" },
  { id: 2, name: "葬送のフリーレン" },
];

test.each(["One Piece", "one piece", "  ONE PIECE ", "One-Piece", "One  Piece", "OnePiece"])(
  "%s is already on the shelf",
  (name) => {
    expect(isOnShelf(name, shelf)).toBe(true);
  },
);

test("a different title isn't", () => {
  expect(isOnShelf("Berserk", shelf)).toBe(false);
  expect(isOnShelf("One Punch Man", shelf)).toBe(false);
});

test("titles with no Latin letters don't all count as the same", () => {
  expect(titleKey("ワンピース")).not.toBe(titleKey("葬送のフリーレン"));
  expect(isOnShelf("ワンピース", shelf)).toBe(false);
  expect(isOnShelf("葬送のフリーレン", shelf)).toBe(true);
});

test("an edit can keep its own name, but not take another's", () => {
  expect(isOnShelf("One Piece", shelf, 1)).toBe(false);
  expect(isOnShelf("One Piece", shelf, 2)).toBe(true);
});

test("spaces don't make a title with no Latin letters a different one", () => {
  expect(isOnShelf("葬送の フリーレン", shelf)).toBe(true);
});

test("a series can be on the shelf as a manga and as a light novel", () => {
  const both = [{ id: 1, name: "Overlord", lightNovel: false }];
  expect(isOnShelf("Overlord", both)).toBe(true);
  expect(isOnShelf("Overlord", both, undefined, true)).toBe(false);
  const novel = [{ id: 2, name: "Overlord", lightNovel: true }];
  expect(isOnShelf("overlord", novel, undefined, true)).toBe(true);
  expect(isOnShelf("Overlord", novel)).toBe(false);
});
