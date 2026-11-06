// Owning volumes with gaps (One Piece 1 and 4), without breaking "up to vol. N"
import { ownedVolumes as onServer } from "../../util/shelf/ownedList.js";
import { toMangaInput } from "../../util/shelf/malEntry.js";
import {
  highestOwned,
  nextToGet,
  ownedOf,
  ownedPhrase,
  ownedVolumes as inBrowser,
  owns,
  parseVolumes,
  rangesText,
  withVolume,
} from "../../../../client/src/lib/ownedVolumes.js";

const CASES: [number | null, number[] | undefined][] = [
  [14, undefined], // up to 14, as ever
  [null, undefined],
  [14, []], // an empty list says nothing more
  [null, [1, 4]], // gaps: kept, up to 4
  [null, [1, 2, 3]], // a run from 1 is just its number
  [7, [3, 1, 2]], // the list wins, sorted
  [null, [4, 1, 4, 1]], // repeats once
  [null, [10.5, 2]],
  [null, [0, 1]], // a vol. 0 isn't a run from 1
  [null, [1000, -1, Number.NaN, 3]], // nonsense dropped
];

test("server and browser agree on every case", () => {
  for (const [n, list] of CASES) expect(inBrowser(n, list)).toEqual(onServer(n, list));
});

test("the rule: gaps are kept, a run from 1 is its number", () => {
  expect(onServer(14, undefined)).toEqual({ volumesOwned: 14, ownedList: [] });
  expect(onServer(null, [4, 1])).toEqual({ volumesOwned: 4, ownedList: [1, 4] });
  expect(onServer(null, [3, 1, 2])).toEqual({ volumesOwned: 3, ownedList: [] });
  expect(onServer(null, [10.5, 2])).toEqual({ volumesOwned: 10, ownedList: [2, 10.5] });
  expect(onServer(null, [1000, -1, Number.NaN, 3])).toEqual({ volumesOwned: 3, ownedList: [3] });
});

test("what they own, read either way", () => {
  expect(ownedOf({ volumesOwned: 3 })).toEqual([1, 2, 3]);
  expect(ownedOf({ volumesOwned: 4, ownedList: [1, 4] })).toEqual([1, 4]);
  expect(owns({ volumesOwned: 3 }, 2)).toBe(true);
  expect(owns({ volumesOwned: 4, ownedList: [1, 4] }, 2)).toBe(false);
  expect(owns({ volumesOwned: 4, ownedList: [1, 4] }, 4)).toBe(true);
  // the price page's "I own Vol. 6": just that one
  expect(withVolume({ volumesOwned: 4, ownedList: [1, 4] }, 6)).toEqual({ volumesOwned: 6, ownedList: [1, 4, 6] });
  // the next one after a run stays a run
  expect(withVolume({ volumesOwned: 3 }, 4)).toEqual({ volumesOwned: 4, ownedList: [] });
  // further on starts a list
  expect(withVolume({ volumesOwned: 3 }, 9)).toEqual({ volumesOwned: 9, ownedList: [1, 2, 3, 9] });
  // filling the gap makes it a run again
  expect(withVolume({ volumesOwned: 3, ownedList: [1, 3] }, 2)).toEqual({ volumesOwned: 3, ownedList: [] });
});

test("written short, typed loosely", () => {
  expect(rangesText([1, 2, 3, 5, 7, 8])).toBe("1–3, 5, 7–8");
  expect(rangesText([1, 4])).toBe("1, 4");
  expect(rangesText([9.5, 10, 11])).toBe("9.5, 10–11");
  expect(parseVolumes("1-5, 8, 10.5")).toEqual([1, 2, 3, 4, 5, 8, 10.5]);
  expect(parseVolumes("1 - 3 4")).toEqual([1, 2, 3, 4]);
  expect(parseVolumes("4, 1, 4")).toEqual([1, 4]);
  expect(parseVolumes("")).toEqual([]);
  expect(parseVolumes("1-a")).toBeNull();
  expect(parseVolumes("5-2")).toBeNull();
  expect(ownedPhrase({ volumesOwned: 14 })).toBe("up to vol. 14");
  expect(ownedPhrase({ volumesOwned: 4, ownedList: [1, 4] })).toBe("vols. 1, 4");
  expect(ownedPhrase({ volumesOwned: 9, ownedList: [9] })).toBe("vol. 9");
  expect(ownedPhrase({ volumesOwned: null })).toBeNull();
  // long lists are cut at a comma
  expect(ownedPhrase({ volumesOwned: 99, ownedList: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] })).toBe("vols. 1, 3, 5, 7, 9, 11, 13…");
});

test("an import's exact list comes in, and the up-to number follows it", () => {
  const entry = { title: "One Piece", finished: false, chapters: 0, readVolumes: 0, ownedVolumes: 4, score: 0 };
  expect(toMangaInput({ ...entry, ownedList: [1, 4] }, null)).toMatchObject({ volumesOwned: 4, ownedList: [1, 4] });
  expect(toMangaInput(entry, null)).toMatchObject({ volumesOwned: 4, ownedList: [] });
});

test("a finished series owned with gaps isn't skipped as owned in full", async () => {
  const { nothingLeftToCheck } = await import("../../controllers/mangaController.js");
  const fma = { status: "FINISHED", volumes: 27 };
  expect(nothingLeftToCheck({ volumesOwned: 27, ownedList: [1, 27] }, fma)).toBe(false);
  expect(nothingLeftToCheck({ volumesOwned: 27, ownedList: [] }, fma)).toBe(true);
});

test("a page from before lists existed doesn't wipe one that's saved", async () => {
  const { keepSavedList } = await import("../../util/shelf/ownedList.js");
  const saved = { volumesOwned: 4, ownedList: [1, 4] };
  // editing with the same "up to": the list stays
  expect(keepSavedList(saved, { volumesOwned: 4 }, "edit")).toEqual(saved);
  // a different "up to": that's what they mean now
  expect(keepSavedList(saved, { volumesOwned: 10 }, "edit")).toEqual({ volumesOwned: 10, ownedList: [] });
  // "I own vol. 6" from an old price page: 6 joins the list
  expect(keepSavedList(saved, { volumesOwned: 6 }, "add one")).toEqual({ volumesOwned: 6, ownedList: [1, 4, 6] });
  // clearing still clears
  expect(keepSavedList(saved, { volumesOwned: null }, "add one")).toEqual({ volumesOwned: null, ownedList: [] });
  // nothing saved: as before
  expect(keepSavedList({ volumesOwned: 3, ownedList: [] }, { volumesOwned: 9 }, "add one")).toEqual({ volumesOwned: 9, ownedList: [] });
});

test("keeping a saved list hands back only the two volume fields", async () => {
  const { keepSavedList } = await import("../../util/shelf/ownedList.js");
  // a whole shelf row, as the edit handler has it
  const row = { id: 7, userId: 1, name: "One Piece", volumesOwned: 6, ownedList: [1, 4, 6] };
  expect(keepSavedList(row, { volumesOwned: 6 }, "edit")).toEqual({ volumesOwned: 6, ownedList: [1, 4, 6] });
});

test("next for you is the one after the furthest they own", () => {
  const out = [1, 2, 3, 4, 5, 6, 7, 7.5, 8];
  // only 2: not 1, which they read somewhere
  expect(nextToGet({ volumesOwned: 2, ownedList: [2] }, out)).toBe(3);
  // a gap before the furthest doesn't count
  expect(nextToGet({ volumesOwned: 5, ownedList: [2, 5] }, out)).toBe(6);
  // a run from 1
  expect(nextToGet({ volumesOwned: 4, ownedList: [] }, out)).toBe(5);
  // a half isn't next, and a half owned still moves them on
  expect(nextToGet({ volumesOwned: 7, ownedList: [] }, out)).toBe(8);
  expect(nextToGet({ volumesOwned: 6, ownedList: [6.5] }, out)).toBe(7);
  // none owned, or the newest owned: nothing next
  expect(nextToGet({ volumesOwned: null, ownedList: [] }, out)).toBeNull();
  expect(nextToGet({ volumesOwned: 8, ownedList: [] }, out)).toBeNull();
  expect(highestOwned({ volumesOwned: 5, ownedList: [2, 5] })).toBe(5);
  expect(highestOwned({ volumesOwned: null, ownedList: [] })).toBe(0);
});
