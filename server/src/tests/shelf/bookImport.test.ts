// the book import is the site's, run in the browser, but has no DOM in it
import {
  groupBooks,
  titleSaysLightNovel,
  parseCsv,
  readBooks,
  toEntry,
} from "../../../../client/src/lib/imports/bookImport.js";
import {
  matchFrom,
  type MatchCandidate,
} from "../../../../client/src/lib/anilist.js";
import {
  mergeBooks,
  mergeSameSeries,
  searchFallbacks,
} from "../../../../client/src/lib/imports/bookImport.js";

const goodreads = (titles: string[]) =>
  readBooks(
    parseCsv(
      [
        "Book Id,Title,Exclusive Shelf,Owned Copies,My Rating,Read Count,Bookshelves",
        ...titles.map((t, i) => `${i},"${t}",read,1,0,1,`),
      ].join("\n"),
    ),
    "goodreads",
  );

test("publishers' light novel tags are spotted", () => {
  expect(
    titleSaysLightNovel("Overlord, Vol. 1 (light novel): The Undead King"),
  ).toBe(true);
  expect(titleSaysLightNovel("Re:ZERO, Vol. 2 (Light Novel)")).toBe(true);
  expect(titleSaysLightNovel("Spice and Wolf, Vol. 3 (LN)")).toBe(true);
  expect(titleSaysLightNovel("Overlord, Vol. 1 (manga)")).toBe(false);
  expect(titleSaysLightNovel("One Piece, Vol. 1: Romance Dawn")).toBe(false);
});

test("the light novel and the manga of a series come in apart", () => {
  const series = groupBooks(
    goodreads([
      "Overlord, Vol. 1 (light novel): The Undead King",
      "Overlord, Vol. 2 (light novel): The Dark Warrior",
      "Overlord, Vol. 1 (manga)",
    ]),
  );
  expect(series).toHaveLength(2);
  const novel = series.find((s) => s.lightNovel)!;
  const manga = series.find((s) => !s.lightNovel)!;
  expect(novel.title).toBe("Overlord");
  expect(novel.books).toBe(2);
  expect(novel.ownedVolumes).toBe(2);
  expect(manga.books).toBe(1);
  expect(toEntry(novel).lightNovel).toBe(true);
  expect(toEntry(manga).lightNovel).toBeUndefined();
});

test("a CSV can say so in a Type column, like the shelf's own export", () => {
  const books = readBooks(
    parseCsv(
      "Title,Type,Status\nSpice and Wolf,Light novel,Reading\nBerserk,Manga,Reading",
    ),
    "csv",
  );
  expect(books.map((b) => b.lightNovel)).toEqual([true, false]);
});

test("the light novel tag doesn't stay in the series name", () => {
  const [series] = groupBooks(
    readBooks(
      parseCsv(
        "Title,Series\nSpice and Wolf Vol. 1,Spice and Wolf (Light Novel)",
      ),
      "csv",
    ),
  );
  expect(series!.title).toBe("Spice and Wolf");
  expect(series!.lightNovel).toBe(true);
});

// ---------- volume numbers and names, from real exports ----------

const seriesOf = (titles: string[]) =>
  groupBooks(goodreads(titles)).map((s) => [s.title, s.ownedVolumes]);

test("a number at the end is a volume when another book backs it up", () => {
  expect(
    seriesOf(["xxxHOLiC 18", "xxxHOLiC 19", "GACHIAKUTA 04", "Gachiakuta T03"]),
  ).toEqual([
    ["xxxHOLiC", 19],
    ["GACHIAKUTA", 4],
  ]);
  // on its own, the number is part of the name
  expect(seriesOf(["Mob Psycho 100"])).toEqual([["Mob Psycho 100", 1]]);
  expect(seriesOf(["Zom 100", "Zom 100 2"])).toEqual([["Zom 100", 2]]);
});

test("volume words in other languages and roman numerals", () => {
  expect(
    seriesOf([
      "Made in Abyss - Tome 12",
      "Overlord - Tome 02",
      "Overlord Band 3",
      "New Departure Handbook Vol. II",
      "ワンピース 第9巻",
    ]),
  ).toEqual([
    ["Made in Abyss", 12],
    ["Overlord", 3],
    ["New Departure Handbook", 2],
    ["ワンピース", 9],
  ]);
});

test("a Japanese and an English name in one title, either way round", () => {
  const series = groupBooks(
    goodreads([
      "メイドインアビス 5 [Made in Abyss 5]",
      "Made in Abyss, Vol. 3",
      "メイドインアビス 6",
      "Ayashimon [アヤシモン]",
      "進撃の巨人 / Attack on Titan",
      "Attack on Titan, Vol. 2",
    ]),
  );
  const abyss = series.find((s) => s.title === "Made in Abyss")!;
  expect(abyss.books).toBe(3);
  expect(abyss.ownedVolumes).toBe(6);
  expect(abyss.otherNames).toEqual(["メイドインアビス"]);
  expect(series.find((s) => s.title === "Ayashimon")!.otherNames).toEqual([
    "アヤシモン",
  ]);
  expect(series.find((s) => s.title === "Attack on Titan")!.books).toBe(2);
  expect(series).toHaveLength(3);
});

test("Japanese names keep their voiced marks when grouped", () => {
  const series = groupBooks(
    goodreads(["約束のネバーランド 1", "約束のネハーランド 2"]),
  );
  expect(series).toHaveLength(2);
});

test("format words and filler come off the name", () => {
  expect(
    seriesOf([
      "Granblue Fantasy (Manga) 4",
      "Granblue Fantasy (Manga) 5",
      "Spice & Wolf: Manga, Vol. 2",
      "Ghost in the Shell, The",
    ]).map(([title]) => title),
  ).toEqual(["Granblue Fantasy", "Spice & Wolf", "The Ghost in the Shell"]);
});

const bookCatalogue = (rows: string[]) =>
  readBooks(
    parseCsv(
      ["title,series_details,bookshelf,read,rating", ...rows].join("\n"),
    ),
    "bookcatalogue",
  );

test("Book Catalogue: a label in the series field isn't a series", () => {
  const series = groupBooks(
    bookCatalogue([
      '"Solo Leveling, Vol. 5",comic,"read,",0,0',
      '"Wolf & Parchment, Vol. 2",Manga,"read,",0,0',
      '"Skip·Beat!, Vol. 4",3-in-1 Edition,"read,",0,0',
      '"Ayashimon, Vol. 1",アヤシモン [Ayashimon] (1),"read,",0,0',
    ]),
  );
  expect(series.map((s) => s.title)).toEqual([
    "Solo Leveling",
    "Wolf & Parchment",
    "Skip·Beat!",
    "Ayashimon",
  ]);
});

test("Book Catalogue: the read shelf counts as read, and don't-own isn't owned", () => {
  const [onShelf, notOwned, wanted] = bookCatalogue([
    'Berserk Vol. 1,,"read,",0,0',
    'Berserk Vol. 2,,"don-t-own-read,to-read,",0,0',
    'Berserk Vol. 3,,"to-read,",0,0',
  ]);
  expect([onShelf!.read, onShelf!.owned]).toEqual([true, true]);
  expect([notOwned!.read, notOwned!.owned, notOwned!.planned]).toEqual([
    true,
    false,
    false,
  ]);
  expect([wanted!.read, wanted!.planned]).toEqual([false, true]);
});

test("the Bookshelf app: its shelf, wishlist, series and volume columns", () => {
  const books = readBooks(
    parseCsv(
      [
        '"Book Id","Bookshelf","Wishlist","Read","Number of copies","My Rating","Title","Series","Volume","Format"',
        '"1","read",0,0,1,,"ワンパンマン 3","ワンパンマン [One Punch Man]","3","paperback"',
        '"2","read",0,0,1,4,"One-Punch Man, Vol. 5","","","paperback"',
        '"3","to-read",1,0,0,,"Frieren, Vol. 1","","","paperback"',
      ].join("\n"),
    ),
    "csv",
  );
  expect(books.map((b) => [b.read, b.owned, b.planned])).toEqual([
    [true, true, false],
    [true, true, false],
    [false, false, true],
  ]);
  const series = groupBooks(books);
  expect(series[0]).toMatchObject({
    title: "One Punch Man",
    books: 2,
    readVolumes: 5,
  });
});

// ---------- matching with AniList ----------

const candidate = (
  id: number,
  english: string | null,
  romaji: string,
  popularity: number,
  synonyms: string[] = [],
): MatchCandidate => ({
  id,
  idMal: id,
  popularity,
  synonyms,
  title: { english, romaji, native: null },
  coverImage: null,
});

test("the result called exactly that wins over AniList's first guess", () => {
  // what AniList's search really put first for "Fairy Tail"
  const results = [
    candidate(1, null, "Pantsu Agerune", 900, ["Fairy Tail Gaiden"]),
    candidate(
      2,
      "Fairy Tail: 100 Years Quest",
      "Fairy Tail: 100 Years Quest",
      30000,
    ),
    candidate(3, "FAIRY TAIL", "FAIRY TAIL", 60000),
  ];
  expect(matchFrom("Fairy Tail", results)?.anilistId).toBe(3);
  expect(
    matchFrom("Hunter × Hunter", [
      candidate(9, "Hunter x Hunter", "HUNTER×HUNTER", 1),
    ])?.anilistId,
  ).toBe(9);
  // nothing called that, and no name that starts the same: not a match
  expect(matchFrom("Fairy Tale", results)).toBeNull();
  expect(matchFrom("Anything", [])).toBeNull();
});

test("shorter searches for a name AniList doesn't know", () => {
  expect(searchFallbacks("Kon Kon Kokon 1")).toEqual(["Kon Kon Kokon"]);
  expect(searchFallbacks("RWBY: The Official Manga: The Beacon Arc")).toEqual([
    "RWBY",
  ]);
  expect(
    searchFallbacks(
      "Made in Abyss Official Anthology - Layer 2: A Dangerous Hole",
    ),
  ).toEqual([
    "Made in Abyss Official Anthology - Layer 2: A Dangerous Hole"
      .split(":")[0]!
      .trim(),
    "Made in Abyss Official Anthology",
  ]);
  expect(searchFallbacks("Berserk")).toEqual([]);
});

test("rows AniList says are one series come in as one", () => {
  const rows = groupBooks(
    goodreads([
      "Children of the Whales, Vol. 23",
      "Kujira no kora wa sajō ni utau 20",
      "Kujira no kora wa sajō ni utau 19",
      "Berserk, Vol. 1",
    ]),
  );
  const ids: Record<string, number> = {
    "Children of the Whales": 7,
    "Kujira no kora wa sajō ni utau": 7,
    Berserk: 8,
  };
  const merged = mergeSameSeries(rows, (s) => ids[s.title]);
  expect(merged).toHaveLength(2);
  expect(merged[0]).toMatchObject({
    title: "Children of the Whales",
    books: 3,
    ownedVolumes: 23,
  });
  expect(merged[0]!.otherNames).toContain("Kujira no kora wa sajō ni utau");
});

test("× and x are the same letter when grouping", () => {
  expect(
    groupBooks(
      goodreads(["Hunter × Hunter, Vol. 38", "Hunter x Hunter, Vol. 2"]),
    ),
  ).toHaveLength(1);
});

// ---------- from the code review ----------

test("a tag in square brackets isn't a second name", () => {
  const series = groupBooks(
    goodreads([
      "One Piece, Vol. 5 [Japanese]",
      "Naruto, Vol. 3 [Japanese]",
      "Berserk, Vol. 1 [Kindle]",
      "Bleach, Vol. 2 [Kindle Edition]",
    ]),
  );
  expect(series.map((s) => s.title)).toEqual([
    "One Piece",
    "Naruto",
    "Berserk",
    "Bleach",
  ]);
});

test("a generic title doesn't join series through its series column", () => {
  const rows = (lines: string[]) =>
    groupBooks(
      readBooks(parseCsv(["Title,Series,Volume", ...lines].join("\n")), "csv"),
    );
  expect(
    rows(["Volume 1,Berserk,", "Volume 2,Vagabond,"]).map((s) => s.title),
  ).toEqual(["Berserk", "Vagabond"]);
  expect(
    rows(["Vol. 1,Berserk,1", "Vol. 2,Vagabond,2"]).map((s) => s.title),
  ).toEqual(["Berserk", "Vagabond"]);
});

test("a shorter name only counts when AniList has exactly that", () => {
  const results = [
    candidate(4, "Star Wars: Lost Stars", "Star Wars: Lost Stars", 5000),
  ];
  expect(matchFrom("Star Wars", results, true)).toBeNull();
  expect(matchFrom("Star Wars", results)?.anilistId).toBe(4);
});

// ---------- from the miss list of the reference files ----------

test("a guess only counts when one name starts with the other", () => {
  // what AniList offered for these
  expect(
    matchFrom("Abenobashi", [candidate(1, null, "Erotoro", 100)]),
  ).toBeNull();
  expect(
    matchFrom("Girl Genius", [
      candidate(2, "A Genius Martial Arts Girl", "x", 100),
    ]),
  ).toBeNull();
  expect(
    matchFrom("Saga", [candidate(3, "New Saga", "New Saga", 100)]),
  ).toBeNull();
  expect(
    matchFrom("Crying Freeman: Portrait of a Killer", [
      candidate(4, "Crying Freeman", "Crying Freeman", 100),
    ])?.anilistId,
  ).toBe(4);
  // the longest that fits wins
  expect(
    matchFrom("Battle Angel Alita - Last Order : Angel Cake", [
      candidate(5, "Battle Angel Alita", "Gunnm", 9000),
      candidate(6, "Battle Angel Alita: Last Order", "Gunnm: Last Order", 3000),
    ])?.anilistId,
  ).toBe(6);
});

test("exact names: articles, & and AniList's long vowels", () => {
  expect(
    matchFrom(
      "Drifting Classroom",
      [candidate(1, "The Drifting Classroom", "Hyouryuu Kyoushitsu", 1)],
      true,
    )?.anilistId,
  ).toBe(1);
  expect(
    matchFrom(
      "Spice and Wolf",
      [candidate(2, "Spice & Wolf", "Ookami to Koushinryou", 1)],
      true,
    )?.anilistId,
  ).toBe(2);
  expect(
    matchFrom(
      "Fushigi Yûgi",
      [candidate(3, "Fushigi Yugi", "Fushigi Yuugi", 1)],
      true,
    )?.anilistId,
  ).toBe(3);
  expect(
    matchFrom(
      "Kujira no kora wa sajō ni utau",
      [
        candidate(
          4,
          "Children of the Whales",
          "Kujira no Kora wa Sajou ni Utau",
          1,
        ),
      ],
      true,
    )?.anilistId,
  ).toBe(4);
});

test("edition words and the creator's name come off", () => {
  expect(
    seriesOf([
      "Dragon Ball VIZBIG Edition, Vol. 2",
      "Parasyte Full Color Collection 3",
      "Parasyte Full Color Collection 4",
      "Gunsmith Cats Revised Edition, Vol. 1",
      "Princess Jellyfish 2-in-1 Omnibus, Vol. 9",
      "Gantz/1",
      "Gantz/3",
    ]),
  ).toEqual([
    ["Dragon Ball", 6],
    ["Parasyte", 4],
    ["Gunsmith Cats", 1],
    ["Princess Jellyfish", 18],
    ["Gantz", 3],
  ]);
  expect(searchFallbacks("Naoki Urasawa's Monster")).toContain("Monster");
  expect(
    searchFallbacks("Sorcerer Hunters -- 100% Authentic Format"),
  ).toContain("Sorcerer Hunters");
});

test("a longer AniList name only fits when the rest is a subtitle", () => {
  expect(
    matchFrom(
      "Chunchu",
      [candidate(1, "Chunchu: The Genocide Fiend", "Chunchu", 1)].map((c) => ({
        ...c,
        title: { ...c.title, romaji: "Chunchu: The Genocide Fiend" },
      })),
    )?.anilistId,
  ).toBe(1);
  expect(
    matchFrom("Justice", [candidate(2, "Justice Now!", "Justice Now!", 1)]),
  ).toBeNull();
  expect(
    matchFrom("Soulless", [
      candidate(3, "The Soulless Duchess", "The Soulless Duchess", 1),
    ]),
  ).toBeNull();
  // a slash joins two names: UDON's "Darkstalkers" comic is not this manga
  expect(
    matchFrom("Darkstalkers", [
      candidate(
        4,
        "Darkstalkers/Red Earth: Maleficarum",
        "Darkstalkers/Red Earth",
        1,
      ),
    ]),
  ).toBeNull();
});

test("a search ending in ! carries on, and so does one missing only the word Manga", () => {
  expect(
    matchFrom("Negima!", [
      candidate(1, "Negima!? Neo", "Negima!? Neo", 2000),
      candidate(2, "Negima! Magister Negi Magi", "Mahou Sensei Negima!", 20000),
    ])?.anilistId,
  ).toBe(2);
  expect(
    matchFrom("RWBY The Official", [
      candidate(3, "RWBY: The Official Manga", "RWBY: The Official Manga", 1),
    ])?.anilistId,
  ).toBe(3);
});

test("the shelf's name key doesn't stop at 80 characters", async () => {
  const { titleKey } = await import("../../util/shelf/titleKey.js");
  const freya =
    "Dungeon ni Deai wo Motomeru no wa Machigatte Iru Darou ka Familia Chronicle Episode Freya";
  const lyu =
    "Dungeon ni Deai wo Motomeru no wa Machigatte Iru Darou ka Familia Chronicle Episode Lyu";
  expect(titleKey(freya)).not.toBe(titleKey(lyu));
  expect(titleKey("One-Piece")).toBe(titleKey("one piece"));
});

// ---------- several files in one import ----------
// the column headers each app exports (from real exports, 2026-11-03)
const HEADERS = {
  goodreads:
    "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies",
  bookcatalogue:
    "_id,author_details,title,isbn,publisher,date_published,rating,bookshelf_id,bookshelf,read,series_details,pages,notes,list_price,anthology,location,read_start,read_end,format,signed,loaned_to,anthology_titles,description,genre,language,date_added,last_update_date,book_uuid",
  bookshelf:
    "Book Id,ISBN,Bookshelf,Tags,Wishlist,Started Reading On,Ended Reading On,Pages Read,Read,My Rating,Review,Title,Subtitle,Authors,Series,Volume",
  csv: "title,author,owned",
};
const headersOf = (k: keyof typeof HEADERS) => HEADERS[k].split(",");

test("each file is known by its own columns", async () => {
  const { fileKind } =
    await import("../../../../client/src/lib/imports/bookImport.js");
  expect(fileKind(headersOf("goodreads"))).toBe("goodreads");
  expect(fileKind(headersOf("bookcatalogue"))).toBe("bookcatalogue");
  expect(fileKind(headersOf("bookshelf"))).toBe("bookshelf");
  // a plain "title" column isn't Book Catalogue any more
  expect(fileKind(headersOf("csv"))).toBe("csv");
  // an older Book Catalogue, before series_details and book_uuid
  expect(
    fileKind([
      "_id",
      "author_details",
      "title",
      "isbn",
      "bookshelf_id",
      "bookshelf",
    ]),
  ).toBe("bookcatalogue");
});

test("each tab takes only its own app's files", async () => {
  const { wrongFile } =
    await import("../../../../client/src/lib/imports/bookImport.js");
  const kinds = ["goodreads", "bookcatalogue", "bookshelf", "csv"] as const;
  const allowed = (source: "goodreads" | "bookcatalogue" | "csv") =>
    kinds.filter((k) => wrongFile("f.csv", source, k, null) === null);
  expect(allowed("goodreads")).toEqual(["goodreads"]);
  expect(allowed("bookcatalogue")).toEqual(["bookcatalogue"]);
  expect(allowed("csv")).toEqual(["bookshelf", "csv"]);
  // and says where it goes
  expect(wrongFile("export.csv", "goodreads", "bookcatalogue", null)).toBe(
    "export.csv is a Book Catalogue export. Add it under Book Catalogue.",
  );
  expect(wrongFile("export.csv", "csv", "goodreads", null)).toMatch(
    /Goodreads export\. Add it under Goodreads/,
  );
  expect(wrongFile("shelf.csv", "bookcatalogue", "bookshelf", null)).toMatch(
    /isn't a Book Catalogue export/,
  );
  // Other app: one kind per import
  expect(wrongFile("b.csv", "csv", "csv", "bookshelf")).toMatch(
    /this import is a Bookshelf app export/,
  );
  expect(wrongFile("b.csv", "csv", "bookshelf", "bookshelf")).toBeNull();
});

test("a book in two files counts once, owned or read in either", async () => {
  const { mergeBooks, groupBooks } =
    await import("../../../../client/src/lib/imports/bookImport.js");
  const older = goodreads([
    "One Piece, Vol. 1",
    "One Piece, Vol. 2",
    "Naruto, Vol. 1",
  ]).map((b) =>
    b.title === "Naruto, Vol. 1"
      ? { ...b, read: false, planned: true, rating: 4 }
      : b,
  );
  const newer = goodreads([
    "One Piece, Vol. 2",
    "One Piece, Vol. 3",
    "Naruto, Vol. 1",
  ]).map((b) =>
    b.title === "Naruto, Vol. 1"
      ? { ...b, read: true, planned: false, rating: 0 }
      : b,
  );
  const merged = mergeBooks(older, newer);
  expect(merged.map((b) => b.title)).toEqual([
    "One Piece, Vol. 1",
    "One Piece, Vol. 2",
    "Naruto, Vol. 1",
    "One Piece, Vol. 3",
  ]);
  const naruto = merged.find((b) => b.title === "Naruto, Vol. 1")!;
  // read in the newer file, so not "to read"; the older file's rating, as the newer has none
  expect([naruto.read, naruto.planned, naruto.rating]).toEqual([
    true,
    false,
    4,
  ]);
  const onePiece = groupBooks(merged).find((s) => s.title === "One Piece")!;
  expect([onePiece.books, onePiece.ownedVolumes]).toEqual([3, 3]);
  // the same file twice changes nothing
  expect(mergeBooks(older, older)).toHaveLength(older.length);
});

test("a book app's owned volumes come in exactly, gaps and all", async () => {
  const { groupBooks, toEntry, mergeSameSeries } =
    await import("../../../../client/src/lib/imports/bookImport.js");
  const owned = (titles: string[]) =>
    goodreads(titles).map((b) => ({ ...b, owned: true, read: false }));
  const [op] = groupBooks(owned(["One Piece, Vol. 1", "One Piece, Vol. 4"]));
  expect(op!.ownedList).toEqual([1, 4]);
  expect(toEntry(op!).ownedList).toEqual([1, 4]);
  // a run from 1 goes as just its number, as before
  const [run] = groupBooks(owned(["Naruto, Vol. 1", "Naruto, Vol. 2"]));
  expect(toEntry(run!).ownedList).toBeUndefined();
  expect(toEntry(run!).ownedVolumes).toBe(2);
  // an owned book without a number keeps the numbered ones exact, and the
  // row is asked about (omnibus)
  const [loose] = groupBooks(
    owned(["Berserk, Vol. 3", "Berserk Deluxe Edition"]),
  );
  expect(loose!.ownedList).toEqual([3]);
  expect(loose!.omnibus).toBe(true);
  expect(toEntry(loose!).ownedList).toEqual([3]);
  // two rows AniList says are one series: their volumes together
  const a = { ...op!, key: "a", ownedList: [1, 4] };
  const b = { ...op!, key: "b", title: "ONE PIECE", ownedList: [6] };
  expect(mergeSameSeries([a, b], () => 13)[0]!.ownedList).toEqual([1, 4, 6]);
  expect(
    mergeSameSeries([a, { ...b, ownedList: null }], () => 13)[0]!.ownedList,
  ).toBeNull();
});

test("an import never sends a volume number the server turns away", async () => {
  const { groupBooks, toEntry } =
    await import("../../../../client/src/lib/imports/bookImport.js");
  // "Blade Runner 2049" read as volume 2049 of a series also owning vol. 3
  const [s] = groupBooks(
    goodreads(["Blade Runner 3", "Blade Runner 2049"]).map((b) => ({
      ...b,
      owned: true,
      read: false,
    })),
  );
  const sent = toEntry(s!).ownedList ?? [];
  expect(sent.every((v) => v >= 0 && v <= 999)).toBe(true);
});

// ---------- a Reddit library's exports (2026-11-05) ----------

import {
  searchPlan,
  volumesInside,
  withoutSpinOffs,
} from "../../../../client/src/lib/imports/bookImport.js";

const owned = (titles: string[]) =>
  groupBooks(goodreads(titles)).map((s) => [
    s.title,
    s.ownedList,
    Boolean(s.omnibus),
  ]);

test("an omnibus counts the volumes it holds, from the surest the title says", () => {
  // listed, also with the "&" an export dropped
  expect(
    volumesInside(
      "Bleach (3-in-1 Edition), Vol. 21: Includes vols. 61, 62 & 63",
      21,
    ),
  ).toEqual({
    holds: [61, 62, 63],
    before: "Bleach (3-in-1 Edition), Vol. 21: ",
  });
  expect(
    volumesInside(
      "Skip Beat! (3-in-1 Edition), Vol. 15: Includes vols. 43, 44  45",
      15,
    ).holds,
  ).toEqual([43, 44, 45]);
  // a list beats the arithmetic: this one really is 3 to 5
  expect(
    volumesInside(
      "Skip Beat! (3-in-1 Edition), Vol. 2: Includes vols. 3, 4 & 5",
      2,
    ).holds,
  ).toEqual([3, 4, 5]);
  // N-in-1 and the omnibus' number
  expect(volumesInside("Bleach (3-in-1 Edition), Vol. 21", 21).holds).toEqual([
    61, 62, 63,
  ]);
  expect(
    volumesInside("Princess Jellyfish 2-in-1 Omnibus, Volume 9", 9).holds,
  ).toEqual([17, 18]);
  // ranges, in a tag, hyphenated, or after a volume word
  expect(
    volumesInside(
      "Negima! Magister Negi Magi, Omnibus 1 (Negima! Magister Negi Magi, #1-3)",
      1,
    ).holds,
  ).toEqual([1, 2, 3]);
  expect(
    volumesInside(
      "One Piece: East Blue 4-5-6, Vol. 2 (One Piece: Omnibus, #2)",
      2,
    ).holds,
  ).toEqual([4, 5, 6]);
  expect(volumesInside("Cardcaptor Sakura, Volume 4-6", 4).holds).toEqual([
    4, 5, 6,
  ]);
  // an omnibus that doesn't say: flagged, its number isn't a volume
  expect(volumesInside("Vinland Saga Omnibus, Vol. 15", 15)).toEqual({
    omnibus: true,
  });
  expect(volumesInside("Orange: The Complete Collection, Volume 2", 2)).toEqual(
    { omnibus: true },
  );
  // a box set that doesn't say which: asked, not guessed as vol. 1
  expect(
    volumesInside("Demon Slayer Complete Box Set: Includes volumes", 1),
  ).toEqual({ omnibus: true });
  // one volume stays one
  expect(
    volumesInside("One Piece, Vol. 1: Romance Dawn (One Piece, #1)", 1),
  ).toEqual({});
  expect(
    volumesInside("Tatsuki Fujimoto Before Chainsaw Man: 17–21", 21),
  ).toEqual({});
});

test("the series of an omnibus is the series, and its volumes join the single ones", () => {
  expect(
    owned([
      "Bleach, Vol. 1",
      "Bleach (3-in-1 Edition), Vol. 21: Includes vols. 61, 62 & 63",
    ]),
  ).toEqual([["Bleach", [1, 61, 62, 63], false]]);
  expect(owned(["Kanokon Omnibus 1-2", "Kanokon Omnibus 3-4"])).toEqual([
    ["Kanokon", [1, 2, 3, 4], false],
  ]);
  expect(owned(["Negima! Volumes 1, 2, and 3 - Bindup - Prop"])).toEqual([
    ["Negima!", [1, 2, 3], false],
  ]);
  // Orange's complete collections don't say which volumes: no exact list, and flagged
  expect(
    owned([
      "Orange: The Complete Collection, Volume 1",
      "Orange: The Complete Collection, Volume 2",
    ]),
  ).toEqual([["Orange", null, true]]);
});

test("an export's dropped '&' comes back, so AniList can find it", () => {
  const [series] = groupBooks(
    goodreads(["Wolf  Parchment: New Theory Spice  Wolf, Vol. 1 (Manga)"]),
  );
  expect(series!.title).toBe("Wolf & Parchment: New Theory Spice & Wolf");
});

test("'No. 1' after a comma is a volume; a name with No. in it stays a name", () => {
  expect(owned(["Crying Freeman, No. 1: Shades of Death"])).toEqual([
    ["Crying Freeman", [1], false],
  ]);
  expect(owned(["Kaiju No. 8, Vol. 3"])).toEqual([["Kaiju No. 8", [3], false]]);
  expect(owned(["No. 6: The Manga, Volume 03"])).toEqual([
    ["No. 6", [3], false],
  ]);
});

test("Viz's Dragon Ball Z volumes are Dragon Ball's, 16 on", () => {
  expect(
    owned([
      "Dragon Ball, Vol. 3",
      "Dragon Ball Z, Vol. 1",
      "Dragon Ball Z, Vol. 5",
    ]),
  ).toEqual([["Dragon Ball", [3, 17, 21], false]]);
});

test("a lone numbered title fills the gap in the one longer series it starts", () => {
  const dating = (n: number) =>
    `Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs (Manga) Vol. ${n}`;
  expect(
    owned([
      dating(1),
      dating(2),
      dating(3),
      "Trapped in a Dating Sim 4",
      dating(5),
    ]),
  ).toEqual([
    [
      "Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs",
      [1, 2, 3, 4, 5],
      false,
    ],
  ]);
  // that volume is there already: it isn't that series' (Before the Fall has a vol. 2)
  expect(
    owned([
      "Attack on Titan: Before the Fall, Vol. 1",
      "Attack on Titan: Before the Fall, Vol. 2",
      "Attack on Titan: Before the Fall, Vol. 3",
      "Attack on Titan 2",
    ]).map((r) => r[0]),
  ).toEqual(["Attack on Titan: Before the Fall", "Attack on Titan 2"]);
});

test("the search order: own names, then exact-only shorter forms, a subtitle cut marked", () => {
  // the name without its number is exact-only: "Star Wars 3" can't become some Star Wars manga
  expect(searchPlan({ title: "Star Wars 3", otherNames: [] })).toEqual([
    { name: "Star Wars 3", exactOnly: false },
    { name: "Star Wars", exactOnly: true },
  ]);
  expect(
    searchPlan({
      title: "Dance in the Vampire Bund: Forgotten Tales",
      otherNames: [],
    }),
  ).toEqual([
    { name: "Dance in the Vampire Bund: Forgotten Tales", exactOnly: false },
    { name: "Dance in the Vampire Bund", exactOnly: true, cut: true },
  ]);
  // the creator's name in front isn't a subtitle: what it finds is the same series
  expect(
    searchPlan({ title: "Naoki Urasawa's Monster", otherNames: [] }),
  ).toEqual([
    { name: "Naoki Urasawa's Monster", exactOnly: false },
    { name: "Monster", exactOnly: true },
  ]);
  // not the manga itself: no shorter form, so it can't become Cardcaptor Sakura
  expect(
    searchPlan({ title: "Cardcaptors: Cinemanga", otherNames: [] }),
  ).toEqual([{ name: "Cardcaptors: Cinemanga", exactOnly: false }]);
});

test("matchFrom says when the series it picked is the search cut short", () => {
  const bund = [
    candidate(1, "Dance in the Vampire Bund", "Dance in the Vampire Bund", 100),
  ];
  expect(matchFrom("Dance in the Vampire Bund", bund)?.fit).toBe("exact");
  expect(
    matchFrom("Dance in the Vampire Bund: Forgotten Tales", bund)?.fit,
  ).toBe("parent");
  const chunchu = [candidate(2, "Chunchu: The Genocide Fiend", "Chunchu", 10)];
  expect(matchFrom("Chunchu", chunchu)?.fit).toBe("exact");
});

test("a typo's double space before 'Vol.' isn't a dropped '&'", () => {
  expect(
    groupBooks(
      goodreads([
        "Chillin' in Another World with Level 2 Super Cheat Powers  Vol. 8",
      ]),
    )[0]!.title,
  ).toBe("Chillin' in Another World with Level 2 Super Cheat Powers");
});

test("a lone numbered manga never joins a light novel's longer name", () => {
  const novel = (n: number) =>
    `Overlord: The Undead King, Vol. ${n} (light novel)`;
  const titles = groupBooks(
    goodreads([novel(1), novel(2), novel(4), "Overlord 3"]),
  ).map((s) => [s.title, s.lightNovel]);
  expect(titles).toContainEqual(["Overlord 3", false]);
});

test("a spin-off found only by a shorter name stays apart when its volumes clash", () => {
  const row = (key: string, ownedList: number[]) => ({
    key,
    title: key,
    otherNames: [],
    books: ownedList.length,
    ownedVolumes: Math.max(...ownedList),
    ownedList,
    readVolumes: 0,
    score: 0,
    planned: false,
    lightNovel: false,
  });
  const bund = row("bund", [1, 2, 3, 4]);
  const tales = row("tales", [1]);
  const alita = row("alita", [1, 2, 3]);
  const tears = row("tears", [9]);
  const matches = new Map([
    [
      "bund",
      {
        anilistId: 1,
        malId: 1,
        name: "Dance in the Vampire Bund",
        cover: null,
      },
    ],
    [
      "tales",
      {
        anilistId: 1,
        malId: 1,
        name: "Dance in the Vampire Bund",
        cover: null,
        shorter: true as const,
      },
    ],
    [
      "alita",
      { anilistId: 2, malId: 2, name: "Battle Angel Alita", cover: null },
    ],
    // found by a shorter name but no clash: more of the same series
    [
      "tears",
      {
        anilistId: 2,
        malId: 2,
        name: "Battle Angel Alita",
        cover: null,
        shorter: true as const,
      },
    ],
  ]);
  const seen = withoutSpinOffs([bund, tales, alita, tears], matches);
  expect(seen.get("tales")).toBeNull();
  expect(seen.get("bund")?.anilistId).toBe(1);
  expect(seen.get("tears")?.anilistId).toBe(2);
});

test("a real title beats another series' other name, and an adult series' other names don't count", () => {
  // AniList lists "Ulysses" as one of an adult manga's other names
  const adult = {
    ...candidate(108410, null, "Sakuramiya Shimai no Netorare Kiroku", 251, [
      "yurisis",
      "Ulysses",
    ]),
    isAdult: true,
  };
  expect(matchFrom("Ulysses", [adult])).toBeNull();
  // its own title still counts
  expect(
    matchFrom("Sakuramiya Shimai no Netorare Kiroku", [adult])?.anilistId,
  ).toBe(108410);
  // a series called that beats a more popular one that only has it as another name
  const titled = candidate(1, "Monster", "Monster", 10);
  const nicknamed = candidate(
    2,
    "Monster Musume",
    "Monster Musume no Iru Nichijou",
    900,
    ["Monster"],
  );
  expect(matchFrom("Monster", [nicknamed, titled])?.anilistId).toBe(1);
  // and other names still find a series nothing is called
  expect(matchFrom("Monster", [nicknamed])?.anilistId).toBe(2);
});

test("second review: typos, guessed numbers, duplicate editions, overflowing renumbering", () => {
  // a double-space typo keeps the name as written too, to search if the "&" one fails
  const [piece] = groupBooks(goodreads(["One  Piece, Vol. 1"]));
  expect([piece!.title, ...piece!.otherNames]).toEqual([
    "One & Piece",
    "One Piece",
  ]);
  const [joined] = groupBooks(
    goodreads(["One  Piece, Vol. 1", "One Piece, Vol. 2", "One Piece, Vol. 3"]),
  );
  expect(joined!.title).toBe("One Piece");
  // a number only guessed from the end isn't an omnibus number
  expect(owned(["Mob Psycho 100 3-in-1"])).toEqual([
    ["Mob Psycho 100", null, false],
  ]);
  // a deluxe book holds three: vol. 1 and Deluxe 1 are 1 to 3
  const [berserk] = groupBooks(
    goodreads(["Berserk, Vol. 1", "Berserk Deluxe Edition, Vol. 1"]),
  );
  expect([berserk!.ownedVolumes, berserk!.ownedList]).toEqual([3, [1, 2, 3]]);
  // DBZ 3-in-1 vol. 9 holds 25-27, past what Viz's numbering maps: left as it is
  expect(owned(["Dragon Ball Z (3-in-1 Edition), Vol. 9"])).toEqual([
    ["Dragon Ball Z", [25, 26, 27], false],
  ]);
});

test("two spin-offs found by the same cut clash with each other, while different volumes are one series", () => {
  const row = (key: string, ownedList: number[]) => ({
    key,
    title: key,
    otherNames: [],
    books: ownedList.length,
    ownedVolumes: Math.max(...ownedList),
    ownedList,
    readVolumes: 0,
    score: 0,
    planned: false,
    lightNovel: false,
  });
  const cutTo = (anilistId: number) => ({
    anilistId,
    malId: null,
    name: "x",
    cover: null,
    shorter: true as const,
  });
  const seen = withoutSpinOffs(
    [
      row("tales", [1]),
      row("scarlet", [1, 2]),
      row("reborn", [1]),
      row("eternal", [3]),
    ],
    new Map([
      ["tales", cutTo(1)],
      ["scarlet", cutTo(1)],
      ["reborn", cutTo(2)],
      ["eternal", cutTo(2)],
    ]),
  );
  expect([seen.get("tales"), seen.get("scarlet")]).toEqual([null, null]);
  expect([
    seen.get("reborn")?.anilistId,
    seen.get("eternal")?.anilistId,
  ]).toEqual([2, 2]);
});

import { isNamedFor } from "../../../../client/src/lib/anilist.js";

test("third review: Japanese numbers, other series that start the same, read-only spin-offs, near names", () => {
  // a number stuck to Japanese text is only a guess: alone, it's the name's
  expect(owned(["モブサイコ100"])).toEqual([["モブサイコ100", null, false]]);
  expect(
    groupBooks(
      goodreads(["One Piece 航海王37: 湯姆先生", "One Piece 航海王 38"]),
    ).map((s) => [s.title, s.ownedList]),
  ).toEqual([["One Piece 航海王", [37, 38]]]);
  // "Dragon Ball Super" just carries on from "Dragon Ball": Dragon Ball 5 isn't its vol. 5
  expect(
    groupBooks(
      goodreads([
        "Dragon Ball Super, Vol. 1",
        "Dragon Ball Super, Vol. 2",
        "Dragon Ball Super, Vol. 6",
        "Dragon Ball 5",
      ]),
    )
      .map((s) => s.title)
      .sort(),
  ).toEqual(["Dragon Ball 5", "Dragon Ball Super"]);
  // two letters apart, from 12 letters on
  expect(isNamedFor("Magic Monsters", ["Magical Monsters"])).toBe(true);
  expect(
    isNamedFor("Animal Academy: Hakobune Hakusho", [
      "Animal Academy",
      "Hakobune Hakusho",
    ]),
  ).toBe(true);
  expect(
    isNamedFor("Dance in the Vampire Bund: Forgotten Tales", [
      "Dance in the Vampire Bund",
      "Dance in the Vampire Bund",
    ]),
  ).toBe(false);
  expect(isNamedFor("Naruto", ["Boruto"])).toBe(false);
});

test("a spin-off they've only read still clashes with the series", () => {
  const row = (key: string, ownedList: number[], readVolumes = 0) => ({
    key,
    title: key,
    otherNames: [],
    books: 1,
    ownedVolumes: ownedList.length ? Math.max(...ownedList) : 0,
    ownedList,
    readVolumes,
    score: 0,
    planned: false,
    lightNovel: false,
  });
  const seen = withoutSpinOffs(
    [row("bund", [1, 2, 3, 4]), row("tales", [], 1)],
    new Map([
      ["bund", { anilistId: 1, malId: null, name: "Bund", cover: null }],
      [
        "tales",
        {
          anilistId: 1,
          malId: null,
          name: "Bund",
          cover: null,
          shorter: true as const,
        },
      ],
    ]),
  );
  expect(seen.get("tales")).toBeNull();
});

test("a number in a Goodreads series tag is part of the series' name", () => {
  expect(
    owned([
      "Mob Psycho 100, Vol. 1",
      "Mob Psycho 100, Vol. 4 (Mob Psycho 100, #4)",
    ]),
  ).toEqual([["Mob Psycho 100", [1, 4], false]]);
  expect(
    owned([
      "Eyeshield 21, Vol. 2 (Eyeshield 21, #2)",
      "Eyeshield 21, Vol. 3 (Eyeshield 21, #3)",
    ]),
  ).toEqual([["Eyeshield 21", [2, 3], false]]);
});

test("a word that ends a real name only counts as an edition before Edition", () => {
  expect(seriesOf(["Rave Master, Vol. 01", "Rave Master, Vol. 03"])).toEqual([
    ["Rave Master", 3],
  ]);
  expect(
    seriesOf(["Berserk Ultimate Edition, Vol. 2", "Berserk, Vol. 4"]),
  ).toEqual([["Berserk", 4]]);
  expect(seriesOf(["Berserk Deluxe, Vol. 2"])).toEqual([["Berserk", 6]]);
});

test("a series named by its subtitle joins the full name in the same file", () => {
  expect(
    seriesOf([
      "Junk: Record of the Last Hero, Vol. 3",
      "Junk: Record of the Last Hero, Vol. 4",
      "Record of the Last Hero, Vol. 5",
    ]),
  ).toEqual([["Junk: Record of the Last Hero", 5]]);
  expect(
    seriesOf([
      "Zero: The Beginning of the Coffin, Vol. 1",
      "Zero 2: The Beginning of the Coffin",
    ]),
  ).toEqual([["Zero: The Beginning of the Coffin", 2]]);
  // a short subtitle stays its own series
  expect(seriesOf(["Fairy Tail: Zero, Vol. 1", "Zero, Vol. 2"])).toEqual([
    ["Fairy Tail: Zero", 1],
    ["Zero", 2],
  ]);
  // without the full name in the file, nothing joins
  expect(seriesOf(["Record of the Last Hero, Vol. 5"])).toEqual([
    ["Record of the Last Hero", 5],
  ]);
});

test("a subtitle-only name joins only a numbered volume the full series lacks", () => {
  // a novel of the same name stays apart
  expect(
    seriesOf([
      "Attack on Titan: Before the Fall, Vol. 1",
      "Attack on Titan: Before the Fall, Vol. 2",
      "Before the Fall",
    ]),
  ).toEqual([
    ["Attack on Titan: Before the Fall", 2],
    ["Before the Fall", 1],
  ]);
  // a number left on the name
  expect(
    seriesOf([
      "Junk: Record of the Last Hero 3",
      "Junk: Record of the Last Hero 4",
      "Record of the Last Hero 5",
    ]),
  ).toEqual([["Junk: Record of the Last Hero", 5]]);
  // "The" in an edition's name comes off with it
  expect(
    seriesOf([
      "Monster: The Perfect Edition, Vol. 1",
      "Monster: The Perfect Edition, Vol. 2",
    ]),
  ).toEqual([["Monster", 4]]);
});

test("a subtitle-only name in one file joins the full name in another", () => {
  const first = goodreads([
    "Junk: Record of the Last Hero, Vol. 3",
    "Junk: Record of the Last Hero, Vol. 4",
  ]);
  const second = goodreads(["Record of the Last Hero, Vol. 5"]);
  expect(
    groupBooks(mergeBooks(first, second)).map((s) => [s.title, s.ownedVolumes]),
  ).toEqual([["Junk: Record of the Last Hero", 5]]);
});

test("editions that hold a set number of volumes count them; other special editions are asked about", () => {
  const [vinland] = groupBooks(
    goodreads(["Vinland Saga Book 1", "Vinland Saga Book 2"]),
  );
  expect([vinland!.title, vinland!.ownedVolumes]).toEqual(["Vinland Saga", 4]);
  const [deluxe] = groupBooks(goodreads(["Berserk Deluxe Edition, Vol. 14"]));
  expect(deluxe!.ownedList).toEqual([40, 41]);
  // every English Vinland Saga book holds two, past Book 7 too
  const [later] = groupBooks(goodreads(["Vinland Saga Book 9"]));
  expect(later!.ownedList).toEqual([17, 18]);
  const [vDeluxe] = groupBooks(goodreads(["Vinland Saga Deluxe 2"]));
  expect(vDeluxe!.ownedList).toEqual([4, 5, 6]);
  const [other] = groupBooks(goodreads(["Uzumaki (Deluxe Edition)"]));
  expect(other!.omnibus).toBe(true);
});

test("a box set beside numbered volumes keeps their gaps", () => {
  const owned = (titles: string[]) =>
    goodreads(titles).map((b) => ({ ...b, owned: true, read: false }));
  const [op] = groupBooks(
    owned([
      "One Piece, Vol. 1",
      "One Piece, Vol. 2",
      "One Piece, Vol. 3",
      "One Piece, Vol. 104",
      // a set whose contents aren't known: asked about, and named
      "One Piece Box Set 9",
    ]),
  );
  expect(op!.ownedList).toEqual([1, 2, 3, 104]);
  expect(op!.omnibus).toBe(true);
  expect(op!.unsure).toEqual(["One Piece Box Set 9"]);
  expect(toEntry(op!).ownedList).toEqual([1, 2, 3, 104]);
});

test("vol. 0 and a half volume are owned, not a run up to them", () => {
  const owned = (titles: string[]) =>
    goodreads(titles).map((b) => ({ ...b, owned: true, read: false }));
  const [jjk] = groupBooks(owned(["Jujutsu Kaisen 0", "Jujutsu Kaisen 1"]));
  expect(jjk!.ownedList).toEqual([0, 1]);
  expect(toEntry(jjk!).ownedList).toEqual([0, 1]);
  const [half] = groupBooks(owned(["Naruto, Vol. 10.5"]));
  expect([half!.ownedVolumes, half!.ownedList]).toEqual([0, [10.5]]);
});

test("Manga Tracker's own export comes back exactly", () => {
  const rows = parseCsv(
    [
      "Title,Type,Status,Chapter,Owned volumes,Rating,Genre,Notes",
      '"One Piece","Manga","Reading","1100","1–3, 104","4","Action","box set too"',
      '"Berserk","Manga","Finished","","1–42","5","",""',
      '"Frieren","Manga","To read","","","","",""',
      '"Overlord","Light novel","Reading","","1–5","","",""',
    ].join("\n"),
  );
  const series = groupBooks(readBooks(rows, "csv"));
  const by = Object.fromEntries(series.map((s) => [s.key, s]));
  expect(by["one piece"]!.ownedList).toEqual([1, 2, 3, 104]);
  expect(toEntry(by["one piece"]!)).toMatchObject({
    chapters: 1100,
    ownedList: [1, 2, 3, 104],
    comments: "box set too",
    finished: false,
  });
  expect(toEntry(by["berserk"]!)).toMatchObject({
    finished: true,
    ownedVolumes: 42,
  });
  expect(by["frieren"]!.planned).toBe(true);
  // bought ahead but not started: still To read, with its volumes; and the
  // genre they set comes back as it was
  const ahead = groupBooks(
    readBooks(
      parseCsv(
        [
          "Title,Type,Status,Chapter,Owned volumes,Rating,Genre,Notes",
          '"Chainsaw Man","Manga","To read","","1–3","","Isekai",""',
        ].join("\n"),
      ),
      "csv",
    ),
  )[0]!;
  expect(toEntry(ahead)).toMatchObject({
    planned: true,
    ownedVolumes: 3,
    genre: "Isekai",
    restore: true,
  });
  expect(by["overlord (light novel)"]!.lightNovel).toBe(true);
  // the older export wrote a run from 1 as its number
  const older = parseCsv(
    [
      "Title,Type,Status,Chapter,Volumes owned,Rating,Genre,Notes",
      '"One Piece","Manga","Reading","0","104","","",""',
      '"Conan","Manga","Reading","0","1, 90","","",""',
    ].join("\n"),
  );
  const [op, conan] = groupBooks(readBooks(older, "csv"));
  expect(op!.ownedVolumes).toBe(104);
  expect(conan!.ownedList).toEqual([1, 90]);
});

test("a backup's names are never joined to another series by a guess", () => {
  const rows = parseCsv(
    [
      "Title,Type,Status,Chapter,Owned volumes,Rating,Genre,Notes",
      '"Junk: Record of the Last Hero","Manga","Reading","","3–4","","",""',
      '"Record of the Last Hero","Manga","Reading","","5","","",""',
    ].join("\n"),
  );
  const series = groupBooks(readBooks(rows, "csv"));
  expect(series.map((s) => s.title).sort()).toEqual([
    "Junk: Record of the Last Hero",
    "Record of the Last Hero",
  ]);
  expect(toEntry(series[0]!).restore).toBe(true);
});

test("a box set is its series, holding what it says or what that set is known to hold", () => {
  const sets = (titles: string[]) =>
    groupBooks(goodreads(titles)).map((s) => [
      s.title,
      s.ownedList?.[0],
      s.ownedList?.[s.ownedList.length - 1],
      s.ownedList?.length,
      Boolean(s.omnibus),
    ]);
  expect(
    sets([
      "Naruto Box Set 1: Volumes 1-27",
      "One Piece Box Set 2",
      "Demon Slayer Complete Box Set",
      "Death Note (All-in-One Edition)",
    ]),
  ).toEqual([
    ["Naruto", 1, 27, 27, false],
    ["One Piece", 24, 46, 23, false],
    ["Demon Slayer", 1, 23, 23, false],
    ["Death Note", 1, 12, 12, false],
  ]);
  // an edition whose books don't map evenly joins its series, and is asked
  // about rather than counted as vol. 1
  const [fma] = groupBooks(
    goodreads([
      "Fullmetal Alchemist: Fullmetal Edition, Vol. 1",
      "Fullmetal Alchemist (3-in-1 Edition), Vol. 9",
    ]),
  );
  expect([fma!.title, fma!.ownedList, fma!.unsure]).toEqual([
    "Fullmetal Alchemist",
    [25, 26, 27],
    ["Fullmetal Alchemist: Fullmetal Edition, Vol. 1"],
  ]);
  // a set nobody knows the contents of owns no volume yet, not "vol. 1"
  const [unknown] = groupBooks(goodreads(["Kagurabachi Box Set 1"]));
  expect([unknown!.title, unknown!.ownedVolumes, unknown!.omnibus]).toEqual([
    "Kagurabachi",
    0,
    true,
  ]);
});
