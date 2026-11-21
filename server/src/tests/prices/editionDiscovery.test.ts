// Finding series by their editions' names (prices/editionDiscovery.ts)
import {
  EDITION_SEARCHES,
  newSeriesIn,
  searchInTurn,
  seriesOfEditionBook,
} from "../../prices/editionDiscovery.js";
import { EDITION_NAMES } from "../../util/shelf/editionNames.js";

test("an edition's book is read as its series", () => {
  expect(
    seriesOfEditionBook(
      "Naruto (3-in-1 Edition), Vol. 4: Includes vols. 10, 11 & 12",
    ),
  ).toBe("Naruto");
  expect(seriesOfEditionBook("Vagabond (VIZBIG Edition), Vol. 1")).toBe(
    "Vagabond",
  );
  expect(seriesOfEditionBook("Berserk Deluxe Volume 1")).toBe("Berserk");
  expect(seriesOfEditionBook("Sailor Moon Eternal Edition 1")).toBe(
    "Sailor Moon",
  );
});

test("a plain volume, a box set or a light novel is no edition's book", () => {
  expect(seriesOfEditionBook("Chainsaw Man, Vol. 1")).toBeNull();
  // the word inside the series' own name
  expect(seriesOfEditionBook("Magical Deluxe Girl, Vol. 1")).toBeNull();
  expect(seriesOfEditionBook("Akira 35th Anniversary Box Set")).toBeNull();
  expect(seriesOfEditionBook("Solo Leveling, Vol. 1 (novel)")).toBeNull();
});

test("only series we don't know, each once", () => {
  const known = new Set(["naruto"]);
  expect(
    newSeriesIn(
      [
        "Naruto (3-in-1 Edition), Vol. 1",
        "Rurouni Kenshin (3-in-1 Edition), Vol. 1",
        "Rurouni Kenshin (3-in-1 Edition), Vol. 2",
        "Chainsaw Man, Vol. 1",
      ],
      known,
    ),
  ).toEqual(["Rurouni Kenshin"]);
});

test("every edition the app knows is searched with every publisher, in turn", () => {
  expect(EDITION_SEARCHES.length % EDITION_NAMES.length).toBe(0);
  for (const edition of EDITION_NAMES)
    expect(EDITION_SEARCHES.some((s) => s.words === edition.label)).toBe(true);
  // round and round: the run after the last is the first again
  expect(searchInTurn(EDITION_SEARCHES.length)).toEqual(searchInTurn(0));
  expect(searchInTurn(1)).not.toEqual(searchInTurn(0));
});
