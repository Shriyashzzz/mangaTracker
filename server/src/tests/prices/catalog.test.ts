import {
  bookFromListing,
  booksFromEditions,
  isIsbn13,
  isMergedWork,
  isSelfPublished,
  isUntranslatedWork,
  volumeRange,
  withBookDigits,
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

test("a self-published book under a series' name isn't a volume of it", () => {
  // Open Library's "Vinland Saga Vol. 11": a notebook, not Kodansha's
  expect(isSelfPublished(["Independently Published"])).toBe(true);
  expect(isSelfPublished(["CreateSpace Independent Publishing Platform"])).toBe(
    true,
  );
  // a real publisher anywhere among a work's editions keeps it
  expect(isSelfPublished(["Independently Published", "Kodansha Comics"])).toBe(
    false,
  );
  expect(isSelfPublished(["Seven Seas"])).toBe(false);
  // nothing known about who published it: kept, as before
  expect(isSelfPublished([])).toBe(false);
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
    expect(isMergedWork({ ...wistoria, isbn: ["9781646515608"] }, name)).toBe(
      false,
    );
    expect(isMergedWork({ ...wistoria, title: "Wistoria, Vol. 2" }, name)).toBe(
      false,
    );
  });
  test("a title ending in a number still counts when it's the series itself", () => {
    const kaiju = { ...wistoria, title: "Kaiju No. 8" };
    expect(isMergedWork(kaiju, "Kaiju No. 8")).toBe(true);
  });
  test("an unrelated book isn't read", () => {
    expect(isMergedWork({ ...wistoria, title: "Wizard and Glass" }, name)).toBe(
      false,
    );
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
    expect(
      booksFromEditions([edition("", "9781646515608")], wistoria, name),
    ).toEqual([]);
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
    const other = {
      title: "Wistoria Grim Actor 1",
      isbn_13: ["9781646515608"],
    };
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
    const doc = {
      key: "/works/x",
      title: "怪獣8号 1",
      isbn: ["9781974749874"],
    };
    expect(isUntranslatedWork(doc, null, "Kaiju No. 8")).toBe(true);
    const right = { title: "Kaiju No. 8, Vol. 1" } as never;
    expect(isUntranslatedWork(doc, right, "Kaiju No. 8")).toBe(false);
    expect(
      isUntranslatedWork(
        { ...doc, isbn: ["9784088825250"] },
        null,
        "Kaiju No. 8",
      ),
    ).toBe(false);
  });
});

// Vinland Saga in English: Kodansha's hardcovers hold two volumes each, and
// Open Library files them under the Japanese title, as answered 2026-11-07
describe("books holding two volumes", () => {
  const work = {
    key: "/works/OL19711472W",
    title: "ヴィンランド・サガ 17‐18",
    isbn: ["9781682337592", "9781632364456"],
    author_name: ["幸村誠", "Makoto Yukimura"],
    publisher: ["Kodansha Comics"],
  };
  const editions = [
    {
      title: "Vinland Saga, Book Nine",
      isbn_13: ["9781682337592"],
      physical_format: "eBook",
      languages: [{ key: "/languages/eng" }],
      publishers: ["Kodansha Comics"],
    },
    {
      title: "Vinland Saga, Book Nine",
      isbn_13: ["9781632364456"],
      physical_format: "Hardcover",
      languages: [{ key: "/languages/eng" }],
      publishers: ["Kodansha Comics"],
      number_of_pages: 392,
    },
  ];

  test("each volume it holds is listed, with the printed book's ISBN", () => {
    const books = booksFromEditions(editions, work, "Vinland Saga");
    expect(books.map((b) => [b.volume, b.isbn13, b.title])).toEqual([
      [17, "9781632364456", "Vinland Saga, Book 9"],
      [18, "9781632364456", "Vinland Saga, Book 9"],
    ]);
    expect(books[0]!.inBook).toEqual({ book: 9, from: 17, to: 18 });
  });

  test("another series' books are left out", () => {
    expect(booksFromEditions(editions, work, "Vagabond")).toEqual([]);
  });

  test("only a Japanese title's two or three volumes count as one book", () => {
    expect(volumeRange("ヴィンランド・サガ 17‐18")).toEqual({
      from: 17,
      to: 18,
    });
    expect(volumeRange("ヴィンランド・サガ 4‐6")).toEqual({ from: 4, to: 6 });
    // a wider range is a box of separate books
    expect(volumeRange("ワンピース 1-10")).toBeNull();
    // an English "1-2" is a set, as before
    expect(volumeRange("Vinland Saga 1-2")).toBeNull();
    expect(volumeRange("葬送のフリーレン 12")).toBeNull();
  });

  test("a book's number in words becomes digits", () => {
    expect(withBookDigits("Vinland Saga, Book Nine")).toBe(
      "Vinland Saga, Book 9",
    );
    expect(withBookDigits("Vinland Saga, Book Fourteen")).toBe(
      "Vinland Saga, Book 14",
    );
    expect(withBookDigits("Monster, Book Twenty-One")).toBe("Monster, Book 21");
    // nothing to do
    expect(withBookDigits("Vinland Saga, Book 3")).toBe("Vinland Saga, Book 3");
    expect(withBookDigits("The Book Thief")).toBe("The Book Thief");
  });
});

// Google Books' listings, held to Open Library's rules (as answered 2026-11-07)
describe("a book Google Books lists", () => {
  test("an upcoming English volume, with its release date", async () => {
    const book = await bookFromListing({
      isbn13: "9798902096672",
      title: "I See You, Aizawa-San! Vol. 1",
      publisher: "Seven Seas",
      published: "2027-03-30",
    });
    expect(book).toMatchObject({
      title: "I See You, Aizawa-San! Vol. 1",
      volume: 1,
      published: "2027-03-30",
    });
  });
  test("other languages' editions and self-published books are left out", async () => {
    // Kurokawa's French edition
    expect(
      await bookFromListing({
        isbn13: "9791042020248",
        title: "Vinland Saga - Tome 29",
      }),
    ).toBeNull();
    expect(
      await bookFromListing({
        isbn13: "9798648967823",
        title: "Vinland Saga Vol. 11",
        publisher: "Independently published",
      }),
    ).toBeNull();
  });
});
