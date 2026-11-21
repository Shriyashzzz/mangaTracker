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
    { number: 1, from: 1, to: 3 },
    { number: 8, from: 22, to: 24 },
  ]),
};
const definitive: LookupLine = {
  key: "definitive",
  label: "Definitive",
  books: booksFromSpans([
    { number: 8, from: 22, to: 24 },
    { number: 13, from: 37, to: 37 },
  ]),
};

test("a volume is answered in every line at once", () => {
  const answers = lookUpVolume([vizbig, definitive], 23);
  expect(answers.map((a) => a.book)).toEqual([
    { name: "VIZBIG 8", inside: "vols. 22–24" },
    { name: "Definitive 8", inside: "vols. 22–24" },
  ]);
});

test("a book of one volume says vol., and a line without it says what it runs", () => {
  const [inVizbig, inDefinitive] = lookUpVolume([vizbig, definitive], 37);
  expect(inDefinitive!.book).toEqual({
    name: "Definitive 13",
    inside: "vol. 37",
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
