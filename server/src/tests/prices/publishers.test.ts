// Who publishes a volume in English: the ISBN's publisher block first, then
// the edition's own publisher, then a known English one from the work's list
import { publisherOf } from "../../prices/publishers.js";

test("a VIZ ISBN is VIZ, whatever foreign edition Open Library lists first", () => {
  expect(
    publisherOf("9781421545356", { work: ["Planeta DeAgostini", "Glénat"] }),
  ).toBe("VIZ Media");
});

test("the edition's own publisher wins over the work's list", () => {
  expect(
    publisherOf("9781111111111", {
      edition: ["Seven Seas Entertainment, LLC"],
      work: ["Ivrea"],
    }),
  ).toBe("Seven Seas");
  expect(publisherOf("9781111111111", { edition: ["Some Small Press"] })).toBe(
    "Some Small Press",
  );
});

test("from the work's list, only a known English publisher counts", () => {
  expect(
    publisherOf("9781111111111", {
      work: ["Norma Editorial", "Dark Horse Manga"],
    }),
  ).toBe("Dark Horse");
  expect(
    publisherOf("9781111111111", { work: ["Planeta DeAgostini", "Ivrea"] }),
  ).toBeNull();
  expect(publisherOf("9781111111111", { work: [null] })).toBeNull();
});

test("an English name not renamed keeps its spelling", () => {
  expect(publisherOf("9781111111111", { work: ["Ghost Ship"] })).toBe(
    "Ghost Ship",
  );
});
