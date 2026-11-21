// "Which book has my volume?" (client lib/editionLookup.ts): every edition a
// series has answers at once, in the app's own words
import {
  booksFromSpans,
  lookUpVolume,
  nextVolumeFor,
  type LookupLine,
} from "../../../../client/src/lib/editionLookup";

const vizbig: LookupLine = {
  key: "vizbig",
  label: "VIZBIG",
  books: booksFromSpans([
    { number: 1, from: 1, to: 3, listed: true },
    { number: 8, from: 22, to: 24, listed: true },
  ]),
};
const definitive: LookupLine = {
  key: "definitive",
  label: "Definitive",
  books: booksFromSpans([
    { number: 8, from: 22, to: 24, listed: true },
    { number: 13, from: 37, to: 37, listed: true },
  ]),
};

test("a volume is answered in every line at once", () => {
  const answers = lookUpVolume([vizbig, definitive], 23);
  expect(answers.map((a) => a.book)).toEqual([
    { name: "VIZBIG 8", inside: "vols. 22–24", coming: null },
    { name: "Definitive 8", inside: "vols. 22–24", coming: null },
  ]);
});

test("a book of one volume says vol., and a line without it says what it runs", () => {
  const [inVizbig, inDefinitive] = lookUpVolume([vizbig, definitive], 37);
  expect(inDefinitive!.book).toEqual({
    name: "Definitive 13",
    inside: "vol. 37",
    coming: null,
  });
  expect(inVizbig!.book).toBeNull();
  expect(inVizbig!.runs).toBe("vols. 1–3, 22–24");
});

test("their next volume: the one after the furthest they own, while a line holds it", () => {
  expect(nextVolumeFor([vizbig], [1, 2, 21])).toBe(22);
  // past every line's end: nothing to start at
  expect(nextVolumeFor([vizbig], [1, 2, 24])).toBeNull();
  expect(nextVolumeFor([vizbig], [])).toBeNull();
});

test("only books a catalog lists show; one with a date ahead is coming", () => {
  const now = new Date(2026, 10, 21);
  const line: LookupLine = {
    key: "definitive",
    label: "Definitive",
    books: [
      {
        number: 7,
        volumes: [19, 20, 21],
        listed: true,
        published: "2026-10-20",
      },
      { number: 8, volumes: [22, 23, 24], listed: true, published: "2027-01" },
      // worked out from the pattern, nobody lists it yet
      { number: 9, volumes: [25, 26, 27], listed: false },
    ],
  };
  const [coming] = lookUpVolume([line], 23, now);
  expect(coming!.book).toEqual({
    name: "Definitive 8",
    inside: "vols. 22–24",
    coming: "Jan 2027",
  });
  const [notListed] = lookUpVolume([line], 26, now);
  expect(notListed!.book).toBeNull();
  expect(notListed!.runs).toBe("vols. 19–24");
});
