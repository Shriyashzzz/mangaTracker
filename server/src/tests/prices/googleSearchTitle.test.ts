// What Google Books is asked for a series (prices/sources/googleBooksCatalog.ts
// searchableTitle): each word of its name, and nothing for a name with no
// word longer than a letter, so Google isn't asked an empty search
import { searchableTitle } from "../../prices/sources/googleBooksCatalog.js";

test("each word of the name, punctuation dropped", () => {
  expect(searchableTitle("Frieren: Beyond Journey's End")).toBe(
    "intitle:Frieren intitle:Beyond intitle:Journey intitle:End",
  );
});

test("a one-letter title gives nothing to search", () => {
  expect(searchableTitle("X")).toBe("");
});

test("a one-letter word beside longer ones is just left out", () => {
  expect(searchableTitle("A Silent Voice")).toBe(
    "intitle:Silent intitle:Voice",
  );
});
