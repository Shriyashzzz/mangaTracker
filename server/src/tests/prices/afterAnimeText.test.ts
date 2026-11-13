// the words the client says for a season (client/src/lib/afterAnimeText.ts),
// over what the server's reader makes of real MangaUpdates lines
import {
  afterLabel,
  answerSentence,
  placeAfter,
  showJsonLd,
  showQuestions,
  endText,
  startText,
  tableRow,
  twoVolumesNote,
  volumesToGet,
  type AnimeStop,
} from "../../../../client/src/lib/afterAnimeText.js";
import { readAnimeStops } from "../../prices/afterAnime/animeLines.js";

const shown = (start: string, end: string): AnimeStop[] =>
  readAnimeStops(start, end).map((stop) => ({
    ...stop,
    corrected: false,
    coversAll: false,
  }));

const [first, second, third] = shown(
  "Vol 1, Chap 1 (S1) / Vol 8, Chap 64 (S2) / Vol 16, Chap 138 (S3)",
  "Vol 8, Chap 63 (S1) / Vol 16, Chap 137 (S2) / Vol 21, Chap 181 Page 14 (S3)",
) as [AnimeStop, AnimeStop, AnimeStop];

test("a season with a known next volume names that one volume", () => {
  expect(afterLabel(first)).toBe("After Season 1");
  expect(startText(first)).toBe("Start at chapter 64");
  expect(endText(first)).toBe("Season 1 ends at chapter 63, in volume 8.");
  expect(volumesToGet(first)).toEqual([
    { volume: 8, why: "Chapter 64 is in this one" },
  ]);
  expect(twoVolumesNote(first)).toBe("");
  expect(startText(second)).toBe("Start at chapter 138");
});

test("a season that stops mid-chapter starts at that chapter, and offers two volumes", () => {
  expect(startText(third)).toBe("Start at chapter 181");
  expect(endText(third)).toBe(
    "Season 3 stops partway through chapter 181, in volume 21.",
  );
  expect(volumesToGet(third).map((v) => v.volume)).toEqual([21, 22]);
  expect(twoVolumesNote(third)).toBe(
    "Chapter 181 is in volume 21 or 22: it depends on whether the anime ended partway through a volume.",
  );
});

test("no season named reads as the anime", () => {
  const [only] = shown("Vol 1, Chap 1", "Vol 4, Chap 17");
  expect(afterLabel(only!)).toBe("After the anime");
  expect(endText(only!)).toBe("The anime ends at chapter 17, in volume 4.");
});

test("chapters without volumes offer no volume", () => {
  const [only] = shown("Chap 0 (S1)", "Chap 45 (S1)");
  expect(startText(only!)).toBe("Start at chapter 46");
  expect(endText(only!)).toBe("Season 1 ends at chapter 45.");
  expect(volumesToGet(only!)).toEqual([]);
});

test("a volume without a chapter says about where to pick up", () => {
  const [only] = shown("Vol 1, Chap 1", "Vol 18 (1996) Different throughout");
  expect(startText(only!)).toBe("Pick up around volume 18");
  expect(endText(only!)).toBe("1996 ends in volume 18.");
  expect(volumesToGet(only!).map((v) => v.volume)).toEqual([18, 19]);
});

test("an anime that adapts all of it has nothing left to read", () => {
  const all = { ...first, endChapter: 271, coversAll: true };
  expect(startText(all)).toBe("You've seen the whole story");
  expect(endText(all)).toBe(
    "Season 1 covers the manga right to its final chapter (271, volume 8). There's nothing new to read after it.",
  );
  expect(volumesToGet(all)).toEqual([]);
});

test("where a watcher is in the manga, for their shelf", () => {
  // season 1 ends at chapter 63 and season 2 starts in volume 8: seven
  // volumes are done
  expect(placeAfter(first)).toEqual({ chapter: 63, volume: 7 });
  // stopped partway through 181, in volume 21: neither is finished
  expect(placeAfter(third)).toEqual({ chapter: 180, volume: 20 });
  const [chaptersOnly] = shown("Chap 0 (S1)", "Chap 45 (S1)");
  expect(placeAfter(chaptersOnly!)).toEqual({ chapter: 45, volume: null });
  const [half] = shown("Vol 1, Chap 0 (S1)", "Vol 5, Chap 22.5 (S1)");
  expect(placeAfter(half!)).toEqual({ chapter: 22, volume: 4 });
});

test("the answer in plain sentences, and as a table row", () => {
  expect(answerSentence(first)).toBe(
    "Season 1 ends at chapter 63, in volume 8. To carry on with the story, start the manga at chapter 64, in volume 8.",
  );
  expect(answerSentence(third)).toBe(
    "Season 3 stops partway through chapter 181, in volume 21. To carry on with the story, start the manga at chapter 181, in volume 21 or 22.",
  );
  expect(tableRow(third)).toEqual({
    watched: "Season 3",
    start: "Chapter 181",
    volume: "21 or 22",
  });
  expect(tableRow(first).volume).toBe("8");
  const all = { ...first, endChapter: 271, coversAll: true };
  expect(answerSentence(all)).toBe(endText(all));
  expect(tableRow(all)).toMatchObject({
    start: "You've seen it all",
    volume: "",
  });
});

test("a show's questions are the ones it can answer", () => {
  const show = {
    name: "Jujutsu Kaisen",
    slug: "jujutsu-kaisen",
    coverUrl: null,
    stops: [first, second, third],
  };
  const questions = showQuestions(show);
  expect(questions.map((question) => question.q)).toEqual([
    "Where does the Jujutsu Kaisen anime leave off in the manga?",
    "What chapter does the Jujutsu Kaisen anime end on?",
    "Which Jujutsu Kaisen volume do I buy after the anime?",
    "Does the Jujutsu Kaisen anime cover the whole manga?",
  ]);
  expect(questions[1]!.a).toBe(
    "Season 1 ends at chapter 63. Season 2 ends at chapter 137. Season 3 stops partway through chapter 181.",
  );
  expect(questions[2]!.a).toBe(
    "After Season 3, the story carries on at chapter 181, which is in volume 21 or 22.",
  );
  expect(questions[3]!.a).toMatch(/^No\. /);
  // the page's markup: its questions, and where it sits in the site
  const markup = showJsonLd(show, "https://example.com");
  expect(markup["@graph"][0]!.mainEntity).toHaveLength(4);
  expect(JSON.stringify(markup["@graph"][1])).toContain(
    "https://example.com/after-the-anime/jujutsu-kaisen",
  );
  // nothing to ask about a show with no seasons
  expect(showQuestions({ ...show, stops: [] })).toEqual([]);
});
