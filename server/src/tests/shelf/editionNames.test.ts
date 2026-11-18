// The one list of editions (util/shelf/editionNames.ts) and the stamp a shelf
// card shows from it (util/shelf/editionStamp.ts).
import {
  EDITION_NAMES,
  editionNameOf,
  withoutEdition,
} from "../../util/shelf/editionNames.js";
import { editionOfBook, editionStamp } from "../../util/shelf/editionStamp.js";
import { editionVolumes } from "../../util/shelf/editions.js";
import {
  editionOfTitle,
  isSetOfBooks,
  omnibusVolumes,
  seriesOfBook,
  setRun,
} from "../../prices/stores/match.js";
import { upToLastVolume } from "../../prices/scanService.js";
import { titleVolume, volumeHeading } from "../../prices/volumeNames.js";
import { coverLinkProblem } from "../../../../client/src/lib/formChecks.js";
import { editionVolumes as pageEditionVolumes } from "../../../../client/src/lib/imports/bookVolumes.js";

const book = (title: string, volumes: number[], edition = "single") => ({
  title,
  edition,
  volumes,
});

test("an edition's words come off the series' name, whatever the edition", () => {
  for (const [name, series] of [
    ["Vagabond VIZBIG Edition", "Vagabond"],
    ["Vagabond Definitive Edition", "Vagabond"],
    ["Berserk Deluxe Edition", "Berserk"],
    ["Berserk Deluxe", "Berserk"],
    ["Monster: The Perfect Edition", "Monster"],
    ["Fruits Basket Collector's Edition", "Fruits Basket"],
    ["Fullmetal Alchemist: Fullmetal Edition", "Fullmetal Alchemist"],
    ["Death Note Black Edition", "Death Note"],
    ["Sailor Moon Eternal Edition", "Sailor Moon"],
    ["Naruto (3-in-1 Edition)", "Naruto"],
    ["One Piece Omnibus Edition", "One Piece"],
    ["Uzumaki 3-in-1 Deluxe Edition", "Uzumaki"],
  ])
    expect([name, withoutEdition(name!)]).toEqual([name, series]);
});

test("a name that only looks like an edition is left alone", () => {
  // "Master" and "Black" end real series names: only before "Edition"
  expect(withoutEdition("Rave Master")).toBe("Rave Master");
  expect(withoutEdition("Black Clover")).toBe("Black Clover");
  expect(withoutEdition("Vagabond")).toBe("Vagabond");
  expect(withoutEdition("The Promised Neverland")).toBe(
    "The Promised Neverland",
  );
  // nothing but the edition's words: kept, never an empty name
  expect(withoutEdition("Deluxe Edition")).toBe("Deluxe Edition");
});

test("a title says which edition it is", () => {
  expect(editionNameOf("Vagabond Definitive Edition, Vol. 3")?.key).toBe(
    "definitive",
  );
  expect(editionNameOf("Vagabond VIZBIG Edition, Vol. 1")?.key).toBe("vizbig");
  expect(editionNameOf("Berserk Deluxe Volume 2")?.key).toBe("deluxe");
  expect(editionNameOf("Vagabond, Vol. 11")).toBe(null);
});

test("every edition has a key a shelf entry can save and a short form", () => {
  const keys = EDITION_NAMES.map((e) => e.key);
  expect(new Set(keys).size).toBe(keys.length);
  for (const edition of EDITION_NAMES) {
    expect(edition.key.length).toBeLessThanOrEqual(20);
    expect(edition.short.length).toBeLessThanOrEqual(6);
    expect(edition.short).toBe(edition.short.toUpperCase());
  }
});

test("the stamp is the edition they own the most books of", () => {
  const books = [
    book("Vagabond Definitive Edition, Vol. 1", [1, 2, 3], "deluxe"),
    book("Vagabond Definitive Edition, Vol. 2", [4, 5, 6], "deluxe"),
    book("Vagabond VIZBIG Edition, Vol. 2", [4, 5, 6], "omnibus"),
    book("Vagabond, Vol. 11", [11]),
  ];
  expect(editionStamp(books, [1, 2, 3, 4, 5, 6, 11])).toEqual({
    label: "Definitive",
    short: "DEF",
    more: 2,
  });
});

test("mostly single volumes: no stamp, and a tie goes to single volumes", () => {
  const deluxe = book("Berserk Deluxe Volume 1", [1, 2, 3], "deluxe");
  // one deluxe book, and vols 4 to 6 ticked by hand
  expect(editionStamp([deluxe], [1, 2, 3, 4, 5, 6])).toBe(null);
  // one of each
  expect(editionStamp([deluxe], [1, 2, 3, 4])).toBe(null);
  // nothing but volumes ticked by hand, or nothing at all
  expect(editionStamp([], [1, 2, 3])).toBe(null);
  expect(editionStamp([], [])).toBe(null);
});

test("one edition alone has no '+', and 'Edition' is dropped on a cover", () => {
  expect(
    editionStamp(
      [book("Fruits Basket Collector's Edition, Vol. 1", [1, 2], "deluxe")],
      [1, 2],
    ),
  ).toEqual({ label: "Collector's", short: "COLL", more: 0 });
});

test("a book whose title names no edition goes by the kind it was saved as", () => {
  expect(editionOfBook({ title: null, edition: "omnibus" })?.label).toBe(
    "Omnibus",
  );
  expect(editionOfBook({ title: "Naruto, Vol. 3", edition: "single" })).toBe(
    null,
  );
  // a box set is a box set, though its title names an edition too
  expect(
    editionOfBook({ title: "Naruto 3-in-1 Box Set", edition: "boxset" })?.short,
  ).toBe("BOX");
  expect(
    editionStamp(
      [{ title: "Naruto Box Set 1", edition: "boxset", volumes: [1, 2] }],
      [1, 2],
    ),
  ).toEqual({ label: "Box set", short: "BOX", more: 0 });
});

test("a Vagabond Definitive holds three volumes, on the server and the page", () => {
  const title = "Vagabond Definitive Edition, Vol. 2";
  expect(editionVolumes("Vagabond Definitive Edition", title, 2)).toEqual([
    4, 5, 6,
  ]);
  expect(pageEditionVolumes("Vagabond", title, 2)).toEqual({
    holds: [4, 5, 6],
  });
  // the 13th book is the last volume alone
  expect(
    editionVolumes("Vagabond", "Vagabond Definitive Edition 13", 13),
  ).toEqual([37]);
});

test("an edition's word inside a series' own name isn't an edition", () => {
  // a plain volume of a series that happens to have the word in its name
  expect(editionOfTitle("Magical Deluxe Girl, Vol. 1")).toBe(null);
  expect(editionOfTitle("My Omnibus Life, Vol. 3")).toBe(null);
  expect(seriesOfBook("Magical Deluxe Girl, Vol. 1")).toBe(
    "Magical Deluxe Girl",
  );
  // the word ending the name, or outside it, is one
  expect(editionOfTitle("Berserk Deluxe Volume 2")?.key).toBe("deluxe");
  expect(editionOfTitle("One Piece (Omnibus Edition), Vol. 1")?.key).toBe(
    "omnibus",
  );
  expect(editionOfTitle("Vagabond, Vol. 11")).toBe(null);
  // and a stamp never comes from such a name
  expect(editionStamp([book("Magical Deluxe Girl, Vol. 1", [1])], [1])).toBe(
    null,
  );
});

test("a book's series is its own, whatever its edition", () => {
  for (const [title, series] of [
    ["Vagabond VIZBIG Edition, Vol. 1", "Vagabond"],
    ["Vagabond Definitive Edition, Vol. 3", "Vagabond"],
    ["Berserk Deluxe Volume 2", "Berserk"],
    ["One Piece (Omnibus Edition), Vol. 1", "One Piece"],
    ["Girl Friends: The Complete Collection 1", "Girl Friends"],
    ["Akira 35th Anniversary Edition, Vol. 1", "Akira"],
    ["BLAME! Master Edition 2", "BLAME!"],
    ["Vagabond, Vol. 11", "Vagabond"],
    ["Rave Master, Vol. 4", "Rave Master"],
  ])
    expect([title, seriesOfBook(title!)]).toEqual([title, series]);
});

test("the edit form lets a book's own cover through, and still checks typed links", () => {
  expect(coverLinkProblem("/api/prices/cover/9781974752584")).toBe(undefined);
  expect(coverLinkProblem("https://example.com/cover.jpg")).toBe(undefined);
  expect(coverLinkProblem("")).toBeFalsy();
  expect(coverLinkProblem("/api/auth/logout")).toBeTruthy();
  expect(coverLinkProblem("cover.jpg")).toBeTruthy();
});

// ---------- found by scanning as a collector would (2026-11-18) ----------

test("a box set is its series', whatever it says after its name", () => {
  expect(
    seriesOfBook(
      "One Piece Box Set 1: East Blue and Baroque Works: Volumes 1-23 with Premium",
    ),
  ).toBe("One Piece");
  expect(
    seriesOfBook("Claymore Complete Box Set: Volumes 1-27 with Premium"),
  ).toBe("Claymore");
  expect(seriesOfBook("Naruto Box Set 2")).toBe("Naruto");
});

test("'complete' before an edition's words goes with them", () => {
  expect(seriesOfBook("Tomie: Complete Deluxe Edition")).toBe("Tomie");
  expect(seriesOfBook("Silent Voice Complete Collector's Edition 1")).toBe(
    "Silent Voice",
  );
});

test("the big-book editions are their series' books too", () => {
  const titles: [string, string, string][] = [
    ["Attack on Titan: Colossal Edition 1", "Attack on Titan", "colossal"],
    ["Fairy Tail: Master's Edition Vol. 1", "Fairy Tail", "masters"],
    [
      "The Legend of Zelda: Ocarina of Time -Legendary Edition-",
      "The Legend of Zelda: Ocarina of Time",
      "legendary",
    ],
    ["Death Note (All-in-One Edition)", "Death Note", "allinone"],
    // and the Master Edition is still its own
    ["Blame! Master Edition 2", "Blame!", "master"],
  ];
  for (const [title, series, key] of titles) {
    expect([title, seriesOfBook(title)]).toEqual([title, series]);
    expect([title, editionOfTitle(title)?.key]).toEqual([title, key]);
  }
  // names that only look like one
  expect(seriesOfBook("Rave Master, Vol. 3")).toBe("Rave Master");
  expect(editionOfTitle("All You Need Is Kill")).toBeNull();
});

test("an Ultimate Edition's name isn't a count: the table says, per series", () => {
  expect(EDITION_NAMES.find((e) => e.key === "ultimate")?.perBook).toBe(
    undefined,
  );
  const cases: [string, string, number, number[]][] = [
    ["Fruits Basket", "Fruits Basket Ultimate Edition Volume 1", 1, [1, 2]],
    ["Battle Royale", "Battle Royale Ultimate Edition Volume 1", 1, [1, 2, 3]],
    [
      "Battle Royale",
      "Battle Royale Ultimate Edition Volume 5",
      5,
      [13, 14, 15],
    ],
  ];
  for (const [series, title, number, holds] of cases) {
    expect(editionVolumes(series, title, number)).toEqual(holds);
    expect(pageEditionVolumes(series, title, number)).toEqual({ holds });
  }
  // any other series' Ultimate Edition isn't known here: it's asked about
  expect(
    editionVolumes("Hellsing", "Hellsing Ultimate Edition 1", 1),
  ).toBeNull();
});

test("the last book of a line holds what's left, more or fewer", () => {
  // nine VIZBIG books for Rurouni Kenshin's 28 volumes
  const kenshin = "Rurouni Kenshin (VIZBIG Edition), Vol. 9";
  expect(editionVolumes("Rurouni Kenshin", kenshin, 9)).toEqual([
    25, 26, 27, 28,
  ]);
  expect(pageEditionVolumes("Rurouni Kenshin", kenshin, 9)).toEqual({
    holds: [25, 26, 27, 28],
  });
  expect(
    editionVolumes(
      "Rurouni Kenshin",
      "Rurouni Kenshin (VIZBIG Edition), Vol. 8",
      8,
    ),
  ).toEqual([22, 23, 24]);
  // Dragon Ball's five VIZBIG books hold its 16 volumes, Dragon Ball Z's
  // nine its 26: each a series of its own
  const dragonBall: [string, string, number, number[]][] = [
    [
      "Dragon Ball",
      "Dragon Ball (VIZBIG Edition), Vol. 5",
      5,
      [13, 14, 15, 16],
    ],
    ["Dragon Ball", "Dragon Ball (VIZBIG Edition), Vol. 4", 4, [10, 11, 12]],
    ["Dragon Ball Z", "Dragon Ball Z (VIZBIG Edition), Vol. 9", 9, [25, 26]],
    [
      "Dragon Ball Z",
      "Dragon Ball Z (VIZBIG Edition), Vol. 5",
      5,
      [13, 14, 15],
    ],
  ];
  for (const [series, title, number, holds] of dragonBall) {
    expect([title, editionVolumes(series, title, number)]).toEqual([
      title,
      holds,
    ]);
    expect(pageEditionVolumes(series, title, number)).toEqual({ holds });
  }
  // and fewer, as before: Berserk Deluxe 14 ends at vol. 41
  expect(editionVolumes("Berserk", "Berserk Deluxe Volume 14", 14)).toEqual([
    40, 41,
  ]);
});

test("a title ending in a long run is a set of those volumes", () => {
  expect(setRun("Naruto #28-48")).toHaveLength(21);
  expect(setRun("Naruto #28-48")?.[0]).toBe(28);
  expect(setRun("Death Note #1-13")?.at(-1)).toBe(13);
  // a short run is an omnibus, read where it always was
  expect(setRun("Naruto #1-3")).toBeNull();
  expect(omnibusVolumes("Naruto #1-3")).toEqual([1, 2, 3]);
  expect(setRun("Naruto, Vol. 48")).toBeNull();
});

test("volumes read off an edition's name stop at a finished series' last", () => {
  const bleach = { status: "FINISHED", volumes: 74 };
  // Bleach's 25th 3-in-1: there is no vol. 75
  expect(upToLastVolume([73, 74, 75], bleach)).toEqual([73, 74]);
  expect(upToLastVolume([70, 71, 72], bleach)).toEqual([70, 71, 72]);
  // nothing real left: the book is asked about
  expect(upToLastVolume([76, 77, 78], bleach)).toBeNull();
  // a series still running, or one we know nothing of, has no last volume
  expect(
    upToLastVolume([73, 74, 75], { status: "RELEASING", volumes: 74 }),
  ).toEqual([73, 74, 75]);
  expect(upToLastVolume([1, 2, 3], null)).toEqual([1, 2, 3]);
});

test("a set named by its run is a set on its price page, never a volume", () => {
  expect(isSetOfBooks("Naruto #28-48")).toBe(true);
  expect(isSetOfBooks("Naruto Box Set 2")).toBe(true);
  expect(isSetOfBooks("Naruto #1-3")).toBe(false);
  expect(isSetOfBooks("Naruto, Vol. 48")).toBe(false);
  expect(titleVolume("Naruto #28-48")).toBeNull();
  expect(titleVolume("Naruto, Vol. 48")).toBe(48);
  expect(volumeHeading("Naruto #28-48", "Naruto", null)).toBe(
    "Naruto, Vols. 28–48",
  );
});
