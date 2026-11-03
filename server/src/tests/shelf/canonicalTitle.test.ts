import { canonicalTitle } from "../../util/shelf/canonicalTitle.js";

const frieren = {
  name: "Frieren: Beyond Journey's End",
  altNames: ["Sousou no Frieren", "Frieren at the Funeral"],
};

test("a title AniList lists becomes AniList's, whatever the case or punctuation", () => {
  expect(canonicalTitle("frieren: beyond journey's end", frieren)).toBe(frieren.name);
  expect(canonicalTitle("FRIEREN BEYOND JOURNEYS-END", { ...frieren, altNames: [] })).toBe(
    "FRIEREN BEYOND JOURNEYS-END",
  );
  expect(canonicalTitle("sousou no frieren", frieren)).toBe(frieren.name);
});

test("AniList's closest guess at something else keeps what they typed", () => {
  expect(canonicalTitle("Frieren", frieren)).toBe("Frieren");
  expect(canonicalTitle("solo", { name: "Solo Leveling", altNames: [] })).toBe("solo");
});

test("not on AniList keeps what they typed", () => {
  expect(canonicalTitle("my doujin", null)).toBe("my doujin");
});

test("a name too long for the form, or a title with no latin letters, stays as typed", () => {
  const long = "x".repeat(151);
  expect(canonicalTitle("Sousou no Frieren", { name: long, altNames: ["Sousou no Frieren"] })).toBe("Sousou no Frieren");
  expect(canonicalTitle("葬送のフリーレン", frieren)).toBe("葬送のフリーレン");
});
