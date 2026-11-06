// Light novels have their own volumes, ISBNs and prices, apart from the manga of
// the same name. Shaped like Open Library's real answers, 2026-11-03
import {
  baseName,
  isNovelName,
  novelName,
  priceName,
} from "../../prices/lightNovel.js";
import {
  booksFromEditions,
  isNovelEdition,
} from "../../prices/sources/catalog.js";
import { seriesName, seriesOf, slugify } from "../../prices/stores/match.js";
import { getReleaseStatus } from "../../util/releases/releaseStatus.js";

test("a novel series goes by its name plus Light Novel, and keeps it", () => {
  expect(novelName("Overlord")).toBe("Overlord Light Novel");
  expect(novelName("Overlord Light Novel")).toBe("Overlord Light Novel");
  expect(baseName("Overlord Light Novel")).toBe("Overlord");
  expect(isNovelName("Overlord Light Novel")).toBe(true);
  expect(isNovelName("Overlord")).toBe(false);
  expect(priceName({ name: "Overlord", lightNovel: true })).toBe(
    "Overlord Light Novel",
  );
  expect(priceName({ name: "Overlord" })).toBe("Overlord");
  // everything that keys by name keeps the two apart
  const volume = "Overlord Light Novel, Vol. 3";
  expect(seriesName(volume)).toBe("Overlord Light Novel");
  expect(seriesOf(volume)).not.toBe(seriesOf("Overlord, Vol. 3"));
  expect(slugify(seriesName(volume))).toBe("overlord-light-novel");
});

test("a novel is told by its title, its subjects or a novel imprint", () => {
  expect(isNovelEdition("Overlord, Vol. 1 (light novel)")).toBe(true);
  // Overlord's novel: Japanese title, the subject says so
  expect(
    isNovelEdition(
      "オーバーロード1 不死者の王",
      ["series:オーバーロード (light novel)", "Fiction"],
      ["Yen Audio", "Yen On"],
    ),
  ).toBe(true);
  expect(isNovelEdition("Spice and Wolf, Vol. 2", [], ["Yen On"])).toBe(true);
  // Overlord's manga
  expect(
    isNovelEdition(
      "Overlord",
      ["Graphic novels", "Comic books, strips"],
      ["Yen Press"],
    ),
  ).toBe(false);
  expect(isNovelEdition("Overlord, Vol. 4 (manga)", [], ["Orbit"])).toBe(false);
});

describe("a work's editions go to the manga or the novel, not both", () => {
  const work = { key: "/works/OL1W", title: "Overlord", isbn: [], subject: [] };
  const editions = [
    {
      title: "Overlord, Vol. 2",
      isbn_13: ["9780316363921"],
      publishers: ["Yen On"],
    },
    {
      title: "Overlord, Vol. 3 (light novel)",
      isbn_13: ["9780316363983"],
      publishers: ["Yen Press"],
    },
    {
      title: "Overlord, Vol. 4",
      isbn_13: ["9780316517430"],
      publishers: ["Yen Press"],
    },
  ];
  test("the manga takes the manga's", () => {
    expect(
      booksFromEditions(editions, work, "Overlord").map((b) => [
        b.volume,
        b.title,
      ]),
    ).toEqual([[4, "Overlord, Vol. 4"]]);
  });
  test("the novel takes the novel's, named as the novel", () => {
    expect(
      booksFromEditions(editions, work, "Overlord Light Novel").map((b) => [
        b.volume,
        b.title,
      ]),
    ).toEqual([
      [2, "Overlord Light Novel, Vol. 2"],
      [3, "Overlord Light Novel, Vol. 3"],
    ]);
  });
});

test("a novel's news is its next English volume, with no chapters", () => {
  const status = getReleaseStatus(
    {
      volumesOwned: 14,
      bookmark: null,
      seenVolume: null,
      seenChapter: null,
      seenJapanVolume: null,
      hiddenVolumes: [],
    },
    {
      dates: null,
      englishVolumes: [14, 15, 16].map((volume) => ({
        volume,
        isbn13: `97803160000${volume}`,
        title: `Overlord Light Novel, Vol. ${volume}`,
      })),
    },
  );
  expect(status.latestVolume).toBe(16);
  expect(status.nextVolumeBook?.title).toBe("Overlord Light Novel, Vol. 15");
  expect(status.latestChapter).toBeNull();
});

test("store listings: the series by its own name, the format apart", async () => {
  const { listingMatches, sameVolume } =
    await import("../../prices/stores/match.js");
  const novel = "Overlord Light Novel, Vol. 3";
  const manga = "Overlord, Vol. 3";
  expect(
    listingMatches(
      "Overlord, Vol. 3 (light novel): The Bloody Valkyrie - Paperback",
      novel,
    ),
  ).toBe(true);
  expect(
    listingMatches("Overlord, Vol. 3 Hardcover by Kugane Maruyama", novel),
  ).toBe(true);
  expect(listingMatches("Overlord, Vol. 3 (manga)", novel)).toBe(false);
  expect(listingMatches("Overlord, Vol. 3 (light novel)", manga)).toBe(false);
  expect(listingMatches("Overlord, Vol. 3 (manga) Paperback", manga)).toBe(
    true,
  );
  expect(sameVolume("Overlord, Vol. 3 (light novel)", novel)).toBe(true);
  expect(sameVolume("Overlord, Vol. 3", manga)).toBe(true);
  expect(sameVolume("Overlord, Vol. 3 (light novel)", manga)).toBe(false);
});

test("a shopping search for a novel isn't told it's manga", async () => {
  const { shoppingQuery } = await import("../../prices/stores/match.js");
  expect(shoppingQuery("Overlord Light Novel, Vol. 15")).toBe(
    "Overlord Light Novel, Vol. 15",
  );
  expect(shoppingQuery("Overlord, Vol. 15")).toBe("Overlord, Vol. 15 manga");
});

test("search: the manga first, its novel right under it, other novels in place", async () => {
  const { withNovels } = await import("../../prices/sources/anilist.js");
  const named = (...names: string[]) => names.map((name) => ({ name }));
  const manga = named(
    "Overlord",
    "Lady Overlord",
    "Overlord: The Undead King Oh!",
  );
  const novels = named("Lowest Overlord Light Novel", "Overlord Light Novel");
  expect(withNovels(manga, novels).map((x) => x.name)).toEqual([
    "Overlord",
    "Overlord Light Novel",
    "Lowest Overlord Light Novel",
    "Lady Overlord",
    "Overlord: The Undead King Oh!",
  ]);
  // asked for novels: the other way round
  expect(
    withNovels(novels, manga)
      .map((x) => x.name)
      .slice(0, 3),
  ).toEqual([
    "Lowest Overlord Light Novel",
    "Overlord Light Novel",
    "Overlord",
  ]);
});

test("novel titles: the number before the volume's own subtitle", async () => {
  const { novelSeriesAndVolume } =
    await import("../../prices/sources/catalog.js");
  const read = (t: string) => {
    const r = novelSeriesAndVolume(t);
    return [r.series, r.volume];
  };
  // as Open Library writes them, 2026-11-04
  expect(
    read("Sword Art Online 9 (light novel): Alicization Beginning"),
  ).toEqual(["Sword Art Online", 9]);
  expect(read("Sword Art Online 2:  Aincrad (light novel)")).toEqual([
    "Sword Art Online",
    2,
  ]);
  expect(read("Sword Art Online 25 (light Novel)")).toEqual([
    "Sword Art Online",
    25,
  ]);
  expect(read("Sword Art Online, Vol. 15 (light novel)")).toEqual([
    "Sword Art Online",
    15,
  ]);
  expect(read("Sword Art Online Progressive 2 - light novel")).toEqual([
    "Sword Art Online Progressive",
    2,
  ]);
  expect(read("Overlord, Vol. 3 (light novel): The Bloody Valkyrie")).toEqual([
    "Overlord",
    3,
  ]);
  expect(read("Ascendance of a Bookworm: Part 1 Volume 3")).toEqual([
    "Ascendance of a Bookworm: Part 1",
    3,
  ]);
  expect(
    read("Re:ZERO -Starting Life in Another World-, Vol. 1 (light novel)"),
  ).toEqual(["Re:ZERO -Starting Life in Another World-", 1]);
  expect(read("86--EIGHTY-SIX, Vol. 4 (light novel)")).toEqual([
    "86--EIGHTY-SIX",
    4,
  ]);
  expect(read("Toradora! (Light Novel) Vol. 3")).toEqual(["Toradora!", 3]);
});

test("from the code review: what doesn't make a book a novel", async () => {
  const { listingMatches } = await import("../../prices/stores/match.js");
  expect(
    isNovelEdition(
      "Overlord, Vol. 1",
      ["Adaptations of light novels", "Comic books, strips"],
      ["Yen Press"],
    ),
  ).toBe(false);
  // editions grouped together: the manga's imprint is there too
  expect(
    isNovelEdition("Overlord", ["Graphic novels"], ["Yen Press", "Yen On"]),
  ).toBe(false);
  expect(isNovelEdition("Overlord", ["Light novels"], ["Yen Press"])).toBe(
    true,
  );
  // a manga volume doesn't take novel listings, however they say it
  expect(listingMatches("Overlord Novel Vol. 3", "Overlord, Vol. 3")).toBe(
    false,
  );
  expect(listingMatches("Overlord LN Vol. 3", "Overlord, Vol. 3")).toBe(false);
  expect(
    listingMatches("Overlord, Vol. 3 Graphic Novel", "Overlord, Vol. 3"),
  ).toBe(true);
});

test("a manga with Novel in its own name keeps its listings", async () => {
  const { listingMatches } = await import("../../prices/stores/match.js");
  expect(
    listingMatches(
      "The Novel's Extra, Vol. 2 (comic)",
      "The Novel's Extra, Vol. 2",
    ),
  ).toBe(true);
});

test("search: two novels by one name both show", async () => {
  const { withNovels } = await import("../../prices/sources/anilist.js");
  const named = (...names: string[]) => names.map((name) => ({ name }));
  const novels = named("Y Light Novel", "Y Light Novel");
  expect(withNovels(named("X", "Y"), novels)).toHaveLength(4);
});

test("the novel called exactly that, not AniList's first guess", async () => {
  const { pickNamed } = await import("../../prices/sources/anilist.js");
  const media = [
    {
      title: { english: "86—EIGHTY-SIX Alter", romaji: "86 Alter" },
      synonyms: [],
    },
    { title: { english: "86—EIGHTY-SIX", romaji: "86" }, synonyms: [] },
  ];
  expect(pickNamed("86—EIGHTY-SIX", media)?.title.english).toBe(
    "86—EIGHTY-SIX",
  );
  expect(pickNamed("Something else", media)?.title.english).toBe(
    "86—EIGHTY-SIX Alter",
  );
});

test("a long manhwa marked (comic) is never taken for a novel", () => {
  const work = {
    key: "/works/OL2W",
    title: "Solo Leveling",
    isbn: [],
    subject: [],
  };
  const [book] = booksFromEditions(
    [
      {
        title: "Solo Leveling, Vol. 5 (comic)",
        isbn_13: ["9781975344382"],
        publishers: ["Yen Press"],
        number_of_pages: 320,
      },
    ],
    work,
    "Solo Leveling",
  );
  expect(book).toMatchObject({ volume: 5, pages: 320, comic: true });
  // and nothing of it goes to the novel's list
  expect(
    booksFromEditions(
      [
        {
          title: "Solo Leveling, Vol. 5 (comic)",
          isbn_13: ["9781975344382"],
          publishers: ["Yen Press"],
        },
      ],
      work,
      "Solo Leveling Light Novel",
    ),
  ).toEqual([]);
});

test("the novel finder counts only this series' novel volumes", async () => {
  const { novelVolumesOf } = await import("../../prices/novelFinder.js");
  const titles = [
    "Solo Leveling Light Novel, Vol. 1",
    "Solo Leveling Light Novel, Vol. 2",
    "Solo Leveling, Vol. 3",
    "Solo Leveling: Ragnarok Light Novel, Vol. 1",
    "Robinson Crusoe",
  ];
  expect(novelVolumesOf(titles, "Solo Leveling")).toBe(2);
  expect(novelVolumesOf(titles, "Omniscient Reader")).toBe(0);
});
