// The one list of editions (util/shelf/editionNames.ts) and the stamp a shelf
// card shows from it (util/shelf/editionStamp.ts).
import {
  EDITION_NAMES,
  editionNameOf,
  withoutEdition,
} from "../../util/shelf/editionNames.js";
import { editionOfBook, editionStamp } from "../../util/shelf/editionStamp.js";
import { editionVolumes } from "../../util/shelf/editions.js";
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
