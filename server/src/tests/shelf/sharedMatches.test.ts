// Shared import matches: the server's copy of the import's rule must agree with
// the browser's, or a fair match would be thrown away, or an unfair one kept
import { matchFrom, type MatchCandidate } from "../../../../client/src/lib/anilist.js";
import { fitsSearch, matchKey } from "../../util/shelf/matchRule.js";
import { fits, matchOf, type Media } from "../../util/shelf/sharedMatches.js";

const candidate = (english: string | null, romaji: string, synonyms: string[] = []): MatchCandidate => ({
  id: 1,
  idMal: null,
  popularity: 1,
  synonyms,
  title: { english, romaji, native: null },
});

// [search, english, romaji, exactOnly], the import tests' own cases and more
const CASES: [string, string | null, string, boolean][] = [
  ["Fairy Tail", "Fairy Tail", "Fairy Tail", false],
  ["Fairy Tale", "Fairy Tail", "Fairy Tail", false],
  ["Hunter × Hunter", "Hunter x Hunter", "HUNTER×HUNTER", false],
  ["Star Wars", "Star Wars: Lost Stars", "Star Wars: Lost Stars", true],
  ["Star Wars", "Star Wars: Lost Stars", "Star Wars: Lost Stars", false],
  ["Abenobashi", null, "Erotoro", false],
  ["Girl Genius", "A Genius Martial Arts Girl", "x", false],
  ["Saga", "New Saga", "New Saga", false],
  ["Crying Freeman: Portrait of a Killer", "Crying Freeman", "Crying Freeman", false],
  ["Drifting Classroom", "The Drifting Classroom", "Hyouryuu Kyoushitsu", true],
  ["Spice and Wolf", "Spice & Wolf", "Ookami to Koushinryou", true],
  ["Fushigi Yûgi", "Fushigi Yugi", "Fushigi Yuugi", true],
  ["Kujira no kora wa sajō ni utau", "Children of the Whales", "Kujira no Kora wa Sajou ni Utau", true],
  ["Chunchu", "Chunchu: The Genocide Fiend", "Chunchu: The Genocide Fiend", false],
  ["Justice", "Justice Now!", "Justice Now!", false],
  ["Soulless", "The Soulless Duchess", "The Soulless Duchess", false],
  ["Darkstalkers", "Darkstalkers/Red Earth: Maleficarum", "Darkstalkers/Red Earth", false],
  ["Negima!", "Negima! Magister Negi Magi", "Mahou Sensei Negima!", false],
  ["RWBY The Official", "RWBY: The Official Manga", "RWBY: The Official Manga", false],
  ["One Piece", "One Piece Party", "One Piece Party", false],
  ["Monster", "Monster Musume: Everyday Life with Monster Girls", "Monster Musume no Iru Nichijou", false],
  ["One Piece", "Killing Stalking", "Killing Stalking", false],
];

test("the server's rule agrees with the browser's on every case", () => {
  for (const [search, english, romaji, exactOnly] of CASES) {
    const browser = matchFrom(search, [candidate(english, romaji)], exactOnly) !== null;
    expect([search, english, exactOnly, fitsSearch(search, [english, romaji].filter((n): n is string => !!n), exactOnly)])
      .toEqual([search, english, exactOnly, browser]);
  }
});

const media = (over: Partial<Media> = {}): Media => ({
  id: 13,
  idMal: 13,
  format: "MANGA",
  synonyms: [],
  title: { english: "One Piece", romaji: "ONE PIECE", native: "ワンピース" },
  coverImage: { extraLarge: "https://img/xl.jpg", large: "https://img/l.jpg" },
  ...over,
});

test("a told match is kept only when the title fits the series AniList says it is", () => {
  const told = { name: "One Piece", lightNovel: false, exactOnly: false };
  expect(fits(told, media())).toBe(true);
  // made up: "One Piece" said to be some other series
  expect(fits(told, media({ title: { english: "Killing Stalking", romaji: "Killing Stalking", native: null } }))).toBe(false);
  // the format has to agree too: a novel search never takes the manga
  expect(fits({ ...told, lightNovel: true }, media())).toBe(false);
  expect(fits({ name: "Overlord", lightNovel: true, exactOnly: false }, media({ format: "NOVEL", title: { english: "Overlord", romaji: "Overlord", native: null } }))).toBe(true);
});

test("what's shared is AniList's own name and cover, not what was told", () => {
  expect(matchOf(media(), "one piece")).toEqual({
    anilistId: 13,
    malId: 13,
    name: "One Piece",
    cover: "https://img/xl.jpg",
  });
});

test("titles are kept as hashes, one per way the import searches", () => {
  const key = matchKey("One Piece", false, false);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
  expect(key).not.toContain("one");
  // the import's own key ignores case, so does this
  expect(matchKey("ONE PIECE", false, false)).toBe(key);
  expect(matchKey("One Piece", true, false)).not.toBe(key);
  expect(matchKey("One Piece", false, true)).not.toBe(key);
});

test("only a series' exact name is shared: a subtitle guess could be another series", () => {
  const titan = media({ id: 53390, title: { english: "Attack on Titan", romaji: "Shingeki no Kyojin", native: null } });
  const beforeTheFall = media({ id: 85312, title: { english: "Attack on Titan: Before the Fall", romaji: "Shingeki no Kyojin: Before the Fall", native: null } });
  const say = (name: string) => ({ name, lightNovel: false, exactOnly: false });
  expect(fits(say("Attack on Titan"), titan)).toBe(true);
  expect(fits(say("Shingeki no Kyojin"), titan)).toBe(true);
  expect(fits(say("Attack on Titan: Before the Fall"), beforeTheFall)).toBe(true);
  // either way round, one is the other plus a subtitle: never shared
  expect(fits(say("Attack on Titan"), beforeTheFall)).toBe(false);
  expect(fits(say("Attack on Titan: Before the Fall"), titan)).toBe(false);
});

test("an adult series' other names aren't shared: they can be loose", () => {
  const adult = media({ id: 108410, isAdult: true, synonyms: ["Ulysses"], title: { english: null, romaji: "Sakuramiya Shimai no Netorare Kiroku", native: null } });
  expect(fits({ name: "Ulysses", lightNovel: false, exactOnly: false }, adult)).toBe(false);
  expect(fits({ name: "Sakuramiya Shimai no Netorare Kiroku", lightNovel: false, exactOnly: false }, adult)).toBe(true);
});
