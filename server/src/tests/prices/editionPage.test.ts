// An edition's own page (/prices/series/vagabond/vizbig): its address, and
// the title and description the app and the site server both give it
// (client/src/lib/editionsWords.ts, pricePaths.ts)
import { editionCanonicalPath } from "../../../../client/src/lib/pricePaths.js";
import {
  editionPageDescription,
  editionPageTitle,
} from "../../../../client/src/lib/editionsWords.js";
import { lineCost, runTotal } from "../../../../client/src/lib/finishCost.js";

test("an edition's address is its series' address and its key", () => {
  expect(editionCanonicalPath("Vagabond", "vizbig")).toBe(
    "/prices/series/vagabond/vizbig",
  );
  expect(editionCanonicalPath("Fullmetal Alchemist", "3in1")).toBe(
    "/prices/series/fullmetal-alchemist/3in1",
  );
});

test("named for the edition, with a total only when there is one", () => {
  expect(editionPageTitle("Vagabond", "VIZBIG", 12)).toBe(
    "Vagabond VIZBIG manga prices, all 12 books",
  );
  expect(editionPageDescription("Vagabond", "VIZBIG", 12, null)).toBe(
    "Which volumes are in each Vagabond VIZBIG book, and US prices for all 12.",
  );
  expect(
    editionPageDescription("Vagabond", "Definitive", 9, "about $360"),
  ).toBe(
    "Which volumes are in each Vagabond Definitive book, and US prices for all 9. Every Definitive book new: about $360.",
  );
});

test("an edition's books cost what the series' singles rule says", () => {
  const book = (isbn13: string, knownPriceCents: number | null) => ({
    isbn13,
    knownPriceCents,
  });
  // 2 of 12 priced, as Vagabond's VIZBIG is: no total
  const vizbig = Array.from({ length: 12 }, (_, i) =>
    book(String(i), i < 2 ? 1999 : null),
  );
  expect(runTotal(lineCost(vizbig))).toBeNull();
  // 3 of 4 priced: the fourth at their middle price, about
  expect(
    runTotal(
      lineCost([
        book("a", 4000),
        book("b", 4400),
        book("c", 4400),
        book("d", null),
      ]),
    ),
  ).toEqual({ cents: 17_000, exact: false });
});
