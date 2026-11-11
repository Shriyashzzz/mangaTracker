// A series' writer and artist from AniList's staff, in English letters: for
// volumes whose catalog record names them only in Japanese
import { creatorsOf, lacksAuthors } from "../../prices/sources/anilist.js";

const staff = (...edges: [role: string, name: string | null][]) => ({
  staff: {
    edges: edges.map(([role, full]) => ({ role, node: { name: { full } } })),
  },
});

test("story and art roles count; assistants and translators don't", () => {
  expect(
    creatorsOf(
      staff(
        ["Story & Art", "Eiichirou Oda"],
        ["Translator (English)", "Stephen Paul"],
        ["Assistant", "Someone Else"],
      ),
    ),
  ).toEqual(["Eiichirou Oda"]);
  expect(
    creatorsOf(staff(["Original Story", "Fuse"], ["Art", "Taiki Kawakami"])),
  ).toEqual(["Fuse", "Taiki Kawakami"]);
});

test("a name only in Japanese, or none, is left out", () => {
  expect(
    creatorsOf(staff(["Story & Art", "尾田栄一郎"], ["Art", null])),
  ).toEqual([]);
  expect(creatorsOf({})).toEqual([]);
});

test("a row saved before authors were asked for is topped up later", () => {
  expect(lacksAuthors({ name: "One Piece", altNames: [] })).toBe(true);
  expect(lacksAuthors({ name: "X", altNames: [], authors: [] })).toBe(false);
  expect(lacksAuthors(null)).toBe(false);
});
