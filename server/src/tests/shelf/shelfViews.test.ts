// What a view of the shelf shows, counts and says (client/src/pages/Home/shelfViews.ts)
import {
  filterShelf,
  isHiddenAs,
  newestOf,
  newsFor,
  shelfCounts,
  TAB_FROM_URL,
  URL_FROM_TAB,
  type Releases,
} from "../../../../client/src/pages/Home/shelfViews.js";
import type { Manga, ReleaseStatus } from "../../../../client/src/lib/types.js";

const manga = (id: number, over: Partial<Manga> = {}) =>
  ({
    id,
    name: `Series ${id}`,
    genre: null,
    status: false,
    planned: false,
    rating: null,
    bookmark: 0,
    volumesOwned: null,
    ownedList: [],
    ...over,
  }) as unknown as Manga;

const found = (over: Partial<ReleaseStatus> = {}) =>
  ({
    hasNewVolume: false,
    hasNewChapter: false,
    hasNewJapaneseVolume: false,
    volumeListed: false,
    chapterListed: false,
    japanListed: false,
    volumeMode: "next",
    chapterMode: "next",
    outVolumes: [],
    outJapanVolumes: [],
    ...over,
  }) as unknown as ReleaseStatus;

const view = {
  tab: "all",
  releaseKind: "volumes" as const,
  viewingHidden: false,
  query: "",
  sortBy: "",
};

const shelf = [
  manga(1, {
    name: "Berserk",
    genre: "Dark fantasy",
    rating: 5,
    bookmark: 300,
  }),
  manga(2, { name: "Monster", status: true, rating: 4, bookmark: 162 }),
  manga(3, { name: "Akira", planned: true }),
  manga(4, { name: "Vagabond", volumesOwned: 3 }),
];

test("each tab shows its series", () => {
  const ids = (tab: string) =>
    filterShelf(shelf, {}, { ...view, tab }).map((m) => m.id);
  expect(ids("all")).toEqual([1, 2, 3, 4]);
  expect(ids("ongoing")).toEqual([1, 4]);
  expect(ids("finished")).toEqual([2]);
  expect(ids("planned")).toEqual([3]);
  expect(ids("volumes")).toEqual([4]);
});

test("search looks at the title and genre, any case", () => {
  const ids = (query: string) =>
    filterShelf(shelf, {}, { ...view, query }).map((m) => m.id);
  expect(ids("  MONSTER ")).toEqual([2]);
  expect(ids("fantasy")).toEqual([1]);
  expect(ids("nothing like it")).toEqual([]);
});

test("the sorts, and last bookmarked keeps the shelf's own order", () => {
  const names = (sortBy: string) =>
    filterShelf(shelf, {}, { ...view, sortBy }).map((m) => m.name);
  expect(names("")).toEqual(["Berserk", "Monster", "Akira", "Vagabond"]);
  expect(names("name-asc")).toEqual([
    "Akira",
    "Berserk",
    "Monster",
    "Vagabond",
  ]);
  expect(names("rating-dsc").slice(0, 2)).toEqual(["Berserk", "Monster"]);
  expect(names("ch-dsc")[0]).toBe("Berserk");
  // the most volumes owned first
  expect(names("vol-dsc")[0]).toBe("Vagabond");
});

test("New shows what's new on this side, and the hidden list what's hidden", () => {
  const releases: Releases = {
    1: found({ hasNewVolume: true, volumeListed: true }),
    // hidden: listed, but nothing newer since
    2: found({ volumeListed: true }),
    // a chapter, not a volume
    4: found({ hasNewChapter: true, chapterListed: true }),
  };
  const ids = (over: object) =>
    filterShelf(shelf, releases, { ...view, tab: "new", ...over }).map(
      (m) => m.id,
    );
  expect(ids({})).toEqual([1]);
  expect(ids({ releaseKind: "chapters" })).toEqual([4]);
  expect(ids({ viewingHidden: true })).toEqual([2]);
  expect(isHiddenAs(releases[2], "volumes")).toBe(true);
  expect(isHiddenAs(releases[1], "volumes")).toBe(false);
});

test("a series on To read never shows on New, as New's count leaves it out", () => {
  // Akira (3) is on To read
  const releases: Releases = {
    1: found({ hasNewVolume: true, volumeListed: true }),
    3: found({ hasNewVolume: true, volumeListed: true }),
  };
  const ids = filterShelf(shelf, releases, { ...view, tab: "new" }).map(
    (m) => m.id,
  );
  expect(ids).toEqual([1]);
  expect(shelfCounts(shelf, releases).newVolumes).toBe(ids.length);
  // nor on the list of what's hidden
  const hidden: Releases = { 3: found({ volumeListed: true }) };
  expect(
    filterShelf(shelf, hidden, { ...view, tab: "new", viewingHidden: true }),
  ).toEqual([]);
});

test("the counts on the tabs, and nothing new counts for a series not started", () => {
  const releases: Releases = {
    1: found({ hasNewVolume: true, hasNewChapter: true }),
    3: found({ hasNewVolume: true }),
  };
  const counts = shelfCounts(shelf, releases);
  expect(counts).toMatchObject({
    all: 4,
    ongoing: 2,
    finished: 1,
    planned: 1,
    volumes: 1,
    newVolumes: 1,
    newChapters: 1,
    newInJapan: 0,
  });
});

test("Hide hides up to the one the card shows, or everything when it lists it all", () => {
  const one = found({
    nextVolume: 5,
    latestVolume: 7,
  } as Partial<ReleaseStatus>);
  const all = found({
    nextVolume: 5,
    latestVolume: 7,
    volumeMode: "all",
  } as Partial<ReleaseStatus>);
  expect(newestOf(one, "volumes")).toBe(5);
  expect(newestOf(all, "volumes")).toBe(7);
});

test("a New card says what's out and where they are, apart", () => {
  const m = manga(1, { volumesOwned: 4, bookmark: 30 });
  const newest = found({
    nextVolume: 5,
    latestVolume: 5,
  } as Partial<ReleaseStatus>);
  expect(newsFor(m, newest, "volumes", false)).toEqual({
    text: "Vol. 5 is out",
    yours: "You own up to vol. 4",
  });
  const behind = found({
    nextVolume: 5,
    latestVolume: 7,
  } as Partial<ReleaseStatus>);
  // theirs next, and how far the series has gone
  expect(newsFor(m, behind, "volumes", false).text).toBe("Vol. 5 next");
  const chapter = found({
    nextChapter: 31,
    latestChapter: 31,
  } as Partial<ReleaseStatus>);
  expect(newsFor(m, chapter, "chapters", false)).toEqual({
    text: "Ch. 31 is out",
    yours: "You're on ch. 30",
  });
});

test("every tab has a word in the address, and back", () => {
  for (const [tab, word] of Object.entries(URL_FROM_TAB))
    expect(TAB_FROM_URL[word]).toBe(tab);
});

test("a card doesn't say twice where they are: Vol. 5 next already means they're on 4", () => {
  const m = manga(1, { volumesOwned: 4, bookmark: 30 });
  const next = (over: Partial<ReleaseStatus>) =>
    newsFor(m, found(over), "volumes", false);
  expect(next({ nextVolume: 5, latestVolume: 7, currentVolume: 4 })).toEqual({
    text: "Vol. 5 next",
    yours: undefined,
  });
  // a gap (they own 4, the next English one is 7) is worth saying
  expect(next({ nextVolume: 7, latestVolume: 9, currentVolume: 4 }).yours).toBe(
    "You own up to vol. 4",
  );
});
