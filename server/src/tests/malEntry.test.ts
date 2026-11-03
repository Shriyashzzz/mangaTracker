import { namesOf, toMangaInput, type MalEntry } from "../util/malEntry.js";

const entry = (over: Partial<MalEntry> = {}): MalEntry => ({
  malId: 35243,
  title: "Haikyuu!!",
  finished: false,
  chapters: 222,
  readVolumes: 22,
  ownedVolumes: 0,
  score: 0,
  ...over,
});

const listing = {
  name: "Attack on Titan",
  altNames: ["Shingeki no Kyojin"],
  cover: "https://example.com/c.jpg",
  genre: "Action",
};

test("uses AniList's name, cover and genre when it has them", () => {
  const input = toMangaInput(entry({ title: "Shingeki no Kyojin" }), listing);
  expect(input.name).toBe("Attack on Titan");
  expect(input.image).toBe(listing.cover);
  expect(input.genre).toBe("Action");
});

test("keeps the MyAnimeList title when AniList has nothing", () => {
  const input = toMangaInput(entry(), null);
  expect(input.name).toBe("Haikyuu!!");
  expect(input.image).toBeNull();
});

test("retail volumes are what they own, otherwise volumes read", () => {
  expect(toMangaInput(entry({ ownedVolumes: 5 }), null).volumesOwned).toBe(5);
  expect(toMangaInput(entry(), null).volumesOwned).toBe(22);
  expect(
    toMangaInput(entry({ readVolumes: 0 }), null).volumesOwned,
  ).toBeNull();
});

test("a score out of 10 becomes stars, and 0 means not rated", () => {
  expect(toMangaInput(entry({ score: 9 }), null).rating).toBe(5);
  expect(toMangaInput(entry({ score: 7 }), null).rating).toBe(4);
  expect(toMangaInput(entry(), null).rating).toBeNull();
});

test("notes are cut to what the shelf allows", () => {
  const input = toMangaInput(entry({ comments: "x".repeat(500) }), null);
  expect(input.description).toHaveLength(450);
});

test("it can be matched under any of its names", () => {
  const names = namesOf(entry({ title: "Shingeki no Kyojin" }), listing);
  expect(names).toContain("attackontitan");
  expect(names).toContain("shingekinokyojin");
});

test("a title with no Latin letters still has a name to match on", () => {
  expect(namesOf(entry({ title: "葬送のフリーレン" }), null)).toEqual(["葬送のフリーレン"]);
});

describe("covers from a book app import", () => {
  const entry = {
    title: "Chainsaw Man",
    finished: false,
    chapters: 0,
    readVolumes: 2,
    ownedVolumes: 4,
    score: 8,
    cover: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/x.jpg",
  };

  test("AniList's cover is used when there's no MyAnimeList listing", () => {
    expect(toMangaInput(entry, null).image).toBe(entry.cover);
  });

  test("a MyAnimeList listing's cover still wins", () => {
    const listing = { name: "Chainsaw Man", altNames: [], cover: "https://listing/cover.jpg", genre: null };
    expect(toMangaInput(entry, listing).image).toBe("https://listing/cover.jpg");
  });
});
