import {
  booksFromEditions,
  isIsbn13,
  isMergedWork,
  isUntranslatedWork,
  toIsbn13,
} from "../../prices/sources/catalog.js";

describe("toIsbn13", () => {
  test("keeps an ISBN-13, ignoring dashes and spaces", () => {
    expect(toIsbn13("978-1-9747-2576-2")).toBe("9781974725762");
  });
  test("converts an ISBN-10 with the right check digit", () => {
    expect(toIsbn13("1974725766")).toBe("9781974725762");
  });
  test("rejects anything else", () => {
    expect(toIsbn13("12345")).toBeNull();
    expect(toIsbn13("not an isbn")).toBeNull();
  });
});

test("isIsbn13", () => {
  expect(isIsbn13("9781974725762")).toBe(true);
  expect(isIsbn13("1974725766")).toBe(false);
});

// shaped like Open Library's real answers for these series, 2026-11-02
describe("works that merge a whole series", () => {
  const wistoria = {
    key: "/works/OL28064210W",
    title: "Wistoria",
    isbn: ["9781646515608", "9781646516247", "9784063144239"],
  };
  const name = "Wistoria: Wand and Sword";
  const edition = (subtitle: string, isbn: string, over = {}) => ({
    title: "Wistoria",
    subtitle,
    isbn_13: [isbn],
    languages: [{ key: "/languages/eng" }],
    ...over,
  });

  test("spots a numberless work with several English editions", () => {
    expect(isMergedWork(wistoria, name)).toBe(true);
  });
  test("one English edition, or a numbered title, is an ordinary work", () => {
    expect(isMergedWork({ ...wistoria, isbn: ["9781646515608"] }, name)).toBe(false);
    expect(
      isMergedWork({ ...wistoria, title: "Wistoria, Vol. 2" }, name),
    ).toBe(false);
  });
  test("a title ending in a number still counts when it's the series itself", () => {
    const kaiju = { ...wistoria, title: "Kaiju No. 8" };
    expect(isMergedWork(kaiju, "Kaiju No. 8")).toBe(true);
  });
  test("an unrelated book isn't read", () => {
    expect(isMergedWork({ ...wistoria, title: "Wizard and Glass" }, name)).toBe(false);
  });

  test("each edition's own number becomes a volume under the series' name", () => {
    const books = booksFromEditions(
      [
        edition("Wand and Sword 1", "9781646515608"),
        edition("Wand and Sword 10", "9798888774656"),
      ],
      wistoria,
      name,
    );
    expect(books.map((b) => [b.volume, b.isbn13, b.title])).toEqual([
      [1, "9781646515608", "Wistoria: Wand and Sword, Vol. 1"],
      [10, "9798888774656", "Wistoria: Wand and Sword, Vol. 10"],
    ]);
  });

  test("an edition with no number is left out, never guessed", () => {
    expect(booksFromEditions([edition("", "9781646515608")], wistoria, name)).toEqual([]);
  });
  test("other languages, foreign ISBNs, sets and light novels stay out", () => {
    const books = booksFromEditions(
      [
        edition("Wand and Sword 2", "9781646516247", {
          languages: [{ key: "/languages/fre" }],
        }),
        edition("Wand and Sword 3", "9788416051816"),
        edition("Wand and Sword Vol. 1-10 Collection Set", "9781646517428"),
        edition("Wand and Sword 4 (light novel)", "9781646517435"),
      ],
      wistoria,
      name,
    );
    expect(books).toEqual([]);
  });
  test("another series in the same work stays out", () => {
    const other = { title: "Wistoria Grim Actor 1", isbn_13: ["9781646515608"] };
    expect(booksFromEditions([other], wistoria, name)).toEqual([]);
  });

  test("a series whose name ends in a number isn't its own volume", () => {
    const books = booksFromEditions(
      [
        { title: "Kaiju No. 8", isbn_13: ["9781974725984"] },
        { title: "Kaiju No. 8, Vol. 1", isbn_13: ["9781974749874"] },
        { title: "Kaiju No. 8 ②", isbn_13: ["9781974729623"] },
      ],
      { key: "/works/x", title: "怪獣8号 1" },
      "Kaiju No. 8",
    );
    expect(books.map((b) => b.volume)).toEqual([1, 2]);
  });

  test("a Japanese title that led elsewhere gets its editions read", () => {
    const doc = { key: "/works/x", title: "怪獣8号 1", isbn: ["9781974749874"] };
    expect(isUntranslatedWork(doc, null, "Kaiju No. 8")).toBe(true);
    const right = { title: "Kaiju No. 8, Vol. 1" } as never;
    expect(isUntranslatedWork(doc, right, "Kaiju No. 8")).toBe(false);
    expect(
      isUntranslatedWork({ ...doc, isbn: ["9784088825250"] }, null, "Kaiju No. 8"),
    ).toBe(false);
  });
});
