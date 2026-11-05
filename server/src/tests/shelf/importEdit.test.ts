// Edit, on a book import's list: their own choice of series and volume count
import { withEdits, withVolumes, type BookSeries, type EditOf } from "../../../../client/src/lib/imports/bookImport.js";

type Edit = EditOf<{ anilistId: number; malId: null; name: string; cover: null }>;

const row = (key: string, ownedList: number[]): BookSeries => ({ key, title: key, otherNames: [], books: ownedList.length, ownedVolumes: Math.max(...ownedList), ownedList, readVolumes: 0, score: 0, planned: false, lightNovel: false });
const match = (anilistId: number, extra: object = {}) => ({ anilistId, malId: null, name: `#${anilistId}`, cover: null, ...extra });

test("their choice of series wins, even over the spin-off check", () => {
  const found = [row("bund", [1, 2, 3]), row("tales", [1])];
  const matches = new Map([["bund", match(1)], ["tales", match(1, { shorter: true })]]);
  // left alone, the spin-off clashes and is not on AniList
  expect(withEdits(found, matches, new Map()).get("tales")).toBeNull();
  // chosen by hand, it stays what they chose
  const edits = new Map<string, Edit>([["tales", { match: match(2) }]]);
  expect(withEdits(found, matches, edits).get("tales")).toEqual(match(2));
  // and "not on AniList" by hand is null
  expect(withEdits(found, matches, new Map<string, Edit>([["bund", { match: null }]])).get("bund")).toBeNull();
});

test("their volume count replaces the file's, gaps and omnibus note too", () => {
  const s = { ...row("vinland", [1, 2, 5]), omnibus: true };
  expect(withVolumes(s, new Map())).toBe(s);
  expect(withVolumes(s, new Map<string, Edit>([["vinland", { volumes: 15 }]]))).toMatchObject({ ownedVolumes: 15, ownedList: null, omnibus: false });
  // a match-only edit leaves the count alone
  expect(withVolumes(s, new Map<string, Edit>([["vinland", { match: match(3) }]]))).toBe(s);
});
