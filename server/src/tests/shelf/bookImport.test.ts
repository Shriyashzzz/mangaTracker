// the book import is the site's, run in the browser, but has no DOM in it
import {
  groupBooks,
  titleSaysLightNovel,
  parseCsv,
  readBooks,
  toEntry,
} from "../../../../client/src/lib/imports/bookImport.js";
import { matchFrom, type MatchCandidate } from "../../../../client/src/lib/anilist.js";
import { mergeSameSeries, searchFallbacks } from "../../../../client/src/lib/imports/bookImport.js";

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
  expect(titleSaysLightNovel("Overlord, Vol. 1 (light novel): The Undead King")).toBe(true);
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
    parseCsv("Title,Type,Status\nSpice and Wolf,Light novel,Reading\nBerserk,Manga,Reading"),
    "csv",
  );
  expect(books.map((b) => b.lightNovel)).toEqual([true, false]);
});

test("the light novel tag doesn't stay in the series name", () => {
  const [series] = groupBooks(
    readBooks(
      parseCsv("Title,Series\nSpice and Wolf Vol. 1,Spice and Wolf (Light Novel)"),
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
  expect(seriesOf(["xxxHOLiC 18", "xxxHOLiC 19", "GACHIAKUTA 04", "Gachiakuta T03"])).toEqual([
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
  expect(series.find((s) => s.title === "Ayashimon")!.otherNames).toEqual(["アヤシモン"]);
  expect(series.find((s) => s.title === "Attack on Titan")!.books).toBe(2);
  expect(series).toHaveLength(3);
});

test("Japanese names keep their voiced marks when grouped", () => {
  const series = groupBooks(goodreads(["約束のネバーランド 1", "約束のネハーランド 2"]));
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
    "Berserk Vol. 1,,\"read,\",0,0",
    "Berserk Vol. 2,,\"don-t-own-read,to-read,\",0,0",
    "Berserk Vol. 3,,\"to-read,\",0,0",
  ]);
  expect([onShelf!.read, onShelf!.owned]).toEqual([true, true]);
  expect([notOwned!.read, notOwned!.owned, notOwned!.planned]).toEqual([true, false, false]);
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
  expect(series[0]).toMatchObject({ title: "One Punch Man", books: 2, readVolumes: 5 });
});

// ---------- matching with AniList ----------


const candidate = (id: number, english: string | null, romaji: string, popularity: number, synonyms: string[] = []): MatchCandidate => ({
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
    candidate(2, "Fairy Tail: 100 Years Quest", "Fairy Tail: 100 Years Quest", 30000),
    candidate(3, "FAIRY TAIL", "FAIRY TAIL", 60000),
  ];
  expect(matchFrom("Fairy Tail", results)?.anilistId).toBe(3);
  expect(matchFrom("Hunter × Hunter", [candidate(9, "Hunter x Hunter", "HUNTER×HUNTER", 1)])?.anilistId).toBe(9);
  // nothing called that, and no name that starts the same: not a match
  expect(matchFrom("Fairy Tale", results)).toBeNull();
  expect(matchFrom("Anything", [])).toBeNull();
});

test("shorter searches for a name AniList doesn't know", () => {
  expect(searchFallbacks("Kon Kon Kokon 1")).toEqual(["Kon Kon Kokon"]);
  expect(searchFallbacks("RWBY: The Official Manga: The Beacon Arc")).toEqual(["RWBY"]);
  expect(searchFallbacks("Made in Abyss Official Anthology - Layer 2: A Dangerous Hole")).toEqual([
    "Made in Abyss Official Anthology - Layer 2: A Dangerous Hole".split(":")[0]!.trim(),
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
  const ids: Record<string, number> = { "Children of the Whales": 7, "Kujira no kora wa sajō ni utau": 7, Berserk: 8 };
  const merged = mergeSameSeries(rows, (s) => ids[s.title]);
  expect(merged).toHaveLength(2);
  expect(merged[0]).toMatchObject({ title: "Children of the Whales", books: 3, ownedVolumes: 23 });
  expect(merged[0]!.otherNames).toContain("Kujira no kora wa sajō ni utau");
});

test("× and x are the same letter when grouping", () => {
  expect(groupBooks(goodreads(["Hunter × Hunter, Vol. 38", "Hunter x Hunter, Vol. 2"]))).toHaveLength(1);
});

// ---------- from the code review ----------

test("a tag in square brackets isn't a second name", () => {
  const series = groupBooks(
    goodreads(["One Piece, Vol. 5 [Japanese]", "Naruto, Vol. 3 [Japanese]", "Berserk, Vol. 1 [Kindle]", "Bleach, Vol. 2 [Kindle Edition]"]),
  );
  expect(series.map((s) => s.title)).toEqual(["One Piece", "Naruto", "Berserk", "Bleach"]);
});

test("a generic title doesn't join series through its series column", () => {
  const rows = (lines: string[]) =>
    groupBooks(readBooks(parseCsv(["Title,Series,Volume", ...lines].join("\n")), "csv"));
  expect(rows(["Volume 1,Berserk,", "Volume 2,Vagabond,"]).map((s) => s.title)).toEqual(["Berserk", "Vagabond"]);
  expect(rows(["Vol. 1,Berserk,1", "Vol. 2,Vagabond,2"]).map((s) => s.title)).toEqual(["Berserk", "Vagabond"]);
});

test("a shorter name only counts when AniList has exactly that", () => {
  const results = [candidate(4, "Star Wars: Lost Stars", "Star Wars: Lost Stars", 5000)];
  expect(matchFrom("Star Wars", results, true)).toBeNull();
  expect(matchFrom("Star Wars", results)?.anilistId).toBe(4);
});

// ---------- from the miss list of the reference files ----------

test("a guess only counts when one name starts with the other", () => {
  // what AniList offered for these
  expect(matchFrom("Abenobashi", [candidate(1, null, "Erotoro", 100)])).toBeNull();
  expect(matchFrom("Girl Genius", [candidate(2, "A Genius Martial Arts Girl", "x", 100)])).toBeNull();
  expect(matchFrom("Saga", [candidate(3, "New Saga", "New Saga", 100)])).toBeNull();
  expect(matchFrom("Crying Freeman: Portrait of a Killer", [candidate(4, "Crying Freeman", "Crying Freeman", 100)])?.anilistId).toBe(4);
  // the longest that fits wins
  expect(
    matchFrom("Battle Angel Alita - Last Order : Angel Cake", [
      candidate(5, "Battle Angel Alita", "Gunnm", 9000),
      candidate(6, "Battle Angel Alita: Last Order", "Gunnm: Last Order", 3000),
    ])?.anilistId,
  ).toBe(6);
});

test("exact names: articles, & and AniList's long vowels", () => {
  expect(matchFrom("Drifting Classroom", [candidate(1, "The Drifting Classroom", "Hyouryuu Kyoushitsu", 1)], true)?.anilistId).toBe(1);
  expect(matchFrom("Spice and Wolf", [candidate(2, "Spice & Wolf", "Ookami to Koushinryou", 1)], true)?.anilistId).toBe(2);
  expect(matchFrom("Fushigi Yûgi", [candidate(3, "Fushigi Yugi", "Fushigi Yuugi", 1)], true)?.anilistId).toBe(3);
  expect(matchFrom("Kujira no kora wa sajō ni utau", [candidate(4, "Children of the Whales", "Kujira no Kora wa Sajou ni Utau", 1)], true)?.anilistId).toBe(4);
});

test("edition words and the creator's name come off", () => {
  expect(seriesOf(["Dragon Ball VIZBIG Edition, Vol. 2", "Parasyte Full Color Collection 3", "Parasyte Full Color Collection 4", "Gunsmith Cats Revised Edition, Vol. 1", "Princess Jellyfish 2-in-1 Omnibus, Vol. 9", "Gantz/1", "Gantz/3"])).toEqual([
    ["Dragon Ball", 2],
    ["Parasyte", 4],
    ["Gunsmith Cats", 1],
    ["Princess Jellyfish", 9],
    ["Gantz", 3],
  ]);
  expect(searchFallbacks("Naoki Urasawa's Monster")).toContain("Monster");
  expect(searchFallbacks("Sorcerer Hunters -- 100% Authentic Format")).toContain("Sorcerer Hunters");
});

test("a longer AniList name only fits when the rest is a subtitle", () => {
  expect(matchFrom("Chunchu", [candidate(1, "Chunchu: The Genocide Fiend", "Chunchu", 1)].map((c) => ({ ...c, title: { ...c.title, romaji: "Chunchu: The Genocide Fiend" } })))?.anilistId).toBe(1);
  expect(matchFrom("Justice", [candidate(2, "Justice Now!", "Justice Now!", 1)])).toBeNull();
  expect(matchFrom("Soulless", [candidate(3, "The Soulless Duchess", "The Soulless Duchess", 1)])).toBeNull();
  expect(matchFrom("Darkstalkers", [candidate(4, "Darkstalkers/Red Earth: Maleficarum", "Darkstalkers/Red Earth", 1)])?.anilistId).toBe(4);
});

test("a search ending in ! carries on, and so does one missing only the word Manga", () => {
  expect(
    matchFrom("Negima!", [
      candidate(1, "Negima!? Neo", "Negima!? Neo", 2000),
      candidate(2, "Negima! Magister Negi Magi", "Mahou Sensei Negima!", 20000),
    ])?.anilistId,
  ).toBe(2);
  expect(matchFrom("RWBY The Official", [candidate(3, "RWBY: The Official Manga", "RWBY: The Official Manga", 1)])?.anilistId).toBe(3);
});

test("the shelf's name key doesn't stop at 80 characters", async () => {
  const { titleKey } = await import("../../util/shelf/titleKey.js");
  const freya = "Dungeon ni Deai wo Motomeru no wa Machigatte Iru Darou ka Familia Chronicle Episode Freya";
  const lyu = "Dungeon ni Deai wo Motomeru no wa Machigatte Iru Darou ka Familia Chronicle Episode Lyu";
  expect(titleKey(freya)).not.toBe(titleKey(lyu));
  expect(titleKey("One-Piece")).toBe(titleKey("one piece"));
});
