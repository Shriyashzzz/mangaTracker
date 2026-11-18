// What the box beside a series' title offers and opens on
// (client/src/pages/Prices/setsBoxRules.ts): box sets first, the reader's
// own pick for that series before anything, and nothing when there's nothing.
import {
  BOX_SETS,
  MOST_REMEMBERED,
  cheapestOf,
  pickedOf,
  readPicks,
  setsOptions,
  withPick,
} from "../../../../client/src/pages/Prices/setsBoxRules.js";

const lines = [
  { key: "definitive", label: "Definitive" },
  { key: "vizbig", label: "VIZBIG" },
];

test("box sets are offered first, then each edition", () => {
  expect(setsOptions("Box sets", lines).map((o) => o.label)).toEqual([
    "Box sets",
    "Definitive",
    "VIZBIG",
  ]);
  // no box set priced: only the editions
  expect(setsOptions(null, lines).map((o) => o.value)).toEqual([
    "definitive",
    "vizbig",
  ]);
  expect(setsOptions(null, [])).toEqual([]);
});

test("it opens on box sets whenever one is priced", () => {
  const options = setsOptions("Box sets", lines);
  expect(pickedOf(options, null, "vizbig")).toBe(BOX_SETS);
});

test("with no box set, it opens on the headline edition, else the first", () => {
  const options = setsOptions(null, lines);
  expect(pickedOf(options, null, "vizbig")).toBe("vizbig");
  expect(pickedOf(options, null, null)).toBe("definitive");
  // a headline that has nothing to show isn't picked
  expect(pickedOf(options, null, "deluxe")).toBe("definitive");
});

test("their own pick for the series comes before box sets", () => {
  const options = setsOptions("Box sets", lines);
  expect(pickedOf(options, "definitive", "vizbig")).toBe("definitive");
  // a pick that's no longer on offer (the edition lost its books) is let go
  expect(pickedOf(options, "deluxe", "vizbig")).toBe(BOX_SETS);
  expect(pickedOf(setsOptions(null, lines), BOX_SETS, null)).toBe("definitive");
});

test("nothing to show: no pick at all", () => {
  expect(pickedOf([], "definitive", "definitive")).toBe(null);
});

test("the cheapest of the prices known, or none", () => {
  expect(cheapestOf([3499, null, 3299, undefined])).toBe(3299);
  expect(cheapestOf([null, undefined])).toBe(null);
  expect(cheapestOf([])).toBe(null);
});

test("picks are remembered per series, the newest last, the oldest let go", () => {
  let picks = readPicks(null);
  picks = withPick(picks, "vagabond", "definitive");
  picks = withPick(picks, "berserk", "deluxe");
  picks = withPick(picks, "vagabond", BOX_SETS);
  expect(picks).toEqual([
    ["berserk", "deluxe"],
    ["vagabond", BOX_SETS],
  ]);
  // read back as saved
  expect(readPicks(JSON.stringify(picks))).toEqual(picks);
  // anything else in that spot reads as nothing
  expect(readPicks("not json")).toEqual([]);
  expect(readPicks('{"vagabond":"sets"}')).toEqual([]);
  expect(readPicks('[["vagabond", 3], "x", ["a","b"]]')).toEqual([["a", "b"]]);
  for (let i = 0; i < MOST_REMEMBERED + 10; i++)
    picks = withPick(picks, `series-${i}`, "omnibus");
  expect(picks.length).toBe(MOST_REMEMBERED);
  expect(picks.some(([name]) => name === "berserk")).toBe(false);
});
