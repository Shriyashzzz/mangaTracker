// A typo in any series search (client/src/lib/nearMatches.ts): its words are
// searched again, and a series counts when every word typed is one of its
// name's, give or take a slip of the finger
import {
  closeEnough,
  slipsBetween,
  withNearMatches,
} from "../../../../client/src/lib/nearMatches.js";

test("a slip of the finger is one letter missing, extra, wrong or swapped", () => {
  expect(slipsBetween("peice", "piece")).toBe(1);
  expect(slipsBetween("sga", "saga")).toBe(1);
  expect(slipsBetween("berserkk", "berserk")).toBe(1);
  expect(slipsBetween("naruto", "naruto")).toBe(0);
  expect(slipsBetween("zzqqxx", "knowing")).toBeGreaterThan(2);
});

test("every word typed is in the name, near enough", () => {
  expect(closeEnough("one peice", "One Piece")).toBe(true);
  expect(closeEnough("vinland sga", "Vinland Saga")).toBe(true);
  expect(closeEnough("chainsw man", "Chainsaw Man")).toBe(true);
  expect(closeEnough("one peice", "One Punch-Man")).toBe(false);
  expect(closeEnough("zzqqxx nothing", "Knowing Nothing")).toBe(false);
});

test("a typo is searched by its words, and only near names are offered", async () => {
  const shelf = [
    "One Piece",
    "One Punch-Man",
    "Vinland Saga",
    "Knowing Nothing",
  ];
  const searched: string[] = [];
  // a search that finds names holding the word exactly, as a typo can't
  const search = async (text: string) => {
    searched.push(text);
    return shelf.filter((name) =>
      name.toLowerCase().split(/\W+/).includes(text.toLowerCase()),
    );
  };
  const title = (name: string) => name;
  expect(await withNearMatches("one peice", search, title)).toEqual({
    hits: ["One Piece"],
    guessed: true,
  });
  // longest word first
  expect(searched).toEqual(["one peice", "peice", "one"]);
  expect(await withNearMatches("zzqqxx nothing", search, title)).toEqual({
    hits: [],
    guessed: false,
  });
});
