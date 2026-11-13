// the words the client says on the "after the anime" pages
// (client/src/lib/afterAnimeText.ts), over what the server's reader makes of
// real MangaUpdates lines
import {
  afterLabel,
  answerSentence,
  answerText,
  buyVolume,
  endText,
  latestAnswer,
  latestAnswerText,
  pageHeading,
  placeAfter,
  showJsonLd,
  showMeta,
  showQuestions,
  startText,
  tableRow,
  volumeAfter,
  whyThisVolume,
  type AnimeStop,
} from "../../../../client/src/lib/afterAnimeText.js";
import { readAnimeStops } from "../../prices/afterAnime/animeLines.js";

const shown = (start: string, end: string): AnimeStop[] =>
  readAnimeStops(start, end).map((stop) => ({
    ...stop,
    corrected: false,
    coversAll: false,
  }));

// Jujutsu Kaisen: season 1 and 2 are followed by a season that says which
// volume it starts in; season 3, the latest, stops partway through a chapter
const [first, second, third] = shown(
  "Vol 1, Chap 1 (S1) / Vol 8, Chap 64 (S2) / Vol 16, Chap 138 (S3)",
  "Vol 8, Chap 63 (S1) / Vol 16, Chap 137 (S2) / Vol 21, Chap 181 Page 14 (S3)",
) as [AnimeStop, AnimeStop, AnimeStop];

// Blue Lock's first season ends with its volume: the next chapter opens the
// next volume
const [endsWithVolume] = shown(
  "Vol 1, Chap 1 (S1) / Vol 12, Chap 95 (S2)",
  "Vol 11, Chap 94 (S1) / Vol 17, Chap 149 (S2)",
) as [AnimeStop];

const finished: AnimeStop = { ...first, endChapter: 271, coversAll: true };

test("a season's panel: its title, the answer, and where it stops", () => {
  expect(afterLabel(first)).toBe("After Season 1");
  expect(afterLabel({ ...first, label: "The anime" })).toBe("After the anime");
  expect(afterLabel({ ...first, label: "Original series" })).toBe(
    "After the original series",
  );
  expect(startText(first)).toBe("Start at chapter 64");
  expect(endText(first)).toBe("Season 1 ends at chapter 63, in volume 8.");
  expect(endText(third)).toBe(
    "Season 3 stops partway through chapter 181, in volume 21.",
  );
});

test("one volume to buy, never two", () => {
  // the next season says which volume the next chapter is in
  expect(buyVolume(first)).toBe(8);
  expect(whyThisVolume(first)).toBe("Chapter 64 is in this volume.");
  expect(volumeAfter(first)).toBeNull();
  // it doesn't: the volume the anime ends in, which never skips a chapter,
  // with the one after offered to someone who has it
  expect(buyVolume(third)).toBe(21);
  expect(whyThisVolume(third)).toBe(
    "The anime ends in this volume, so you miss nothing.",
  );
  expect(volumeAfter(third)).toBe(22);
  // nothing to carry on with, or no volume on record
  expect(buyVolume(finished)).toBeNull();
  expect(volumeAfter(finished)).toBeNull();
  const [chaptersOnly] = shown("Chap 0 (S1)", "Chap 45 (S1)");
  expect(buyVolume(chaptersOnly!)).toBeNull();
});

test("a season that ends with its volume doesn't name that volume", () => {
  // "ends in volume 11" beside a card for volume 12 reads as a mistake
  expect(buyVolume(endsWithVolume)).toBe(12);
  expect(endText(endsWithVolume)).toBe("Season 1 ends at chapter 94.");
});

test("no season named reads as the anime", () => {
  const [only] = shown("Vol 1, Chap 1", "Vol 4, Chap 17");
  expect(endText(only!)).toBe("The anime ends at chapter 17, in volume 4.");
  expect(latestAnswer(only!).detail).toBe("The anime ends at chapter 17.");
});

test("a volume without a chapter starts at that volume", () => {
  const [only] = shown("Vol 1, Chap 1", "Vol 18 (1996) Different throughout");
  expect(startText(only!)).toBe("Start with volume 18");
  expect(endText(only!)).toBe("1996 ends in volume 18.");
  expect(latestAnswer(only!).lead).toBe(
    "After 1996, start the manga at volume 18.",
  );
});

test("an anime that adapts all of it has nothing left to read", () => {
  expect(startText(finished)).toBe("That's the whole story");
  expect(endText(finished)).toBe(
    "Season 1 covers the manga to its final chapter, 271.",
  );
  expect(latestAnswer(finished)).toEqual({
    lead: "The anime covers the whole manga.",
    detail:
      "Season 1 is the latest, and it ends at the manga's final chapter, 271.",
  });
});

test("the page's opening answer says what to do, then where the anime stops", () => {
  expect(latestAnswer(second)).toEqual({
    lead: "After Season 2, start the manga at chapter 138. Buy volume 16.",
    detail: "Season 2 is the latest, and it ends at chapter 137.",
  });
  expect(latestAnswer(third)).toEqual({
    lead: "After Season 3, start the manga at chapter 181. Buy volume 21.",
    detail: "Season 3 is the latest, and it stops partway through chapter 181.",
  });
  const [chaptersOnly] = shown("Chap 0 (S1)", "Chap 45 (S1)");
  expect(latestAnswer(chaptersOnly!).lead).toBe(
    "After Season 1, start the manga at chapter 46.",
  );
  expect(latestAnswerText(second)).toBe(
    "After Season 2, start the manga at chapter 138. Buy volume 16. Season 2 is the latest, and it ends at chapter 137.",
  );
});

test("a season as a row of the table, and in sentences for search engines", () => {
  expect(tableRow(third)).toEqual({
    watched: "Season 3",
    start: "181",
    volume: "21",
  });
  expect(tableRow(finished)).toEqual({
    watched: "Season 1",
    start: "Nothing left to read",
    volume: "",
  });
  expect(answerSentence(first)).toBe(
    "Season 1 ends at chapter 63, in volume 8. Start the manga at chapter 64. Buy volume 8.",
  );
  expect(answerSentence(finished)).toBe(endText(finished));
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

const show = {
  name: "Jujutsu Kaisen",
  slug: "jujutsu-kaisen",
  coverUrl: null,
  stops: [first, second, third],
};

test("a show's questions: all of them for search, only the new ones shown", () => {
  const questions = showQuestions(show);
  expect(questions.map((question) => question.q)).toEqual([
    "Where does the Jujutsu Kaisen anime leave off in the manga?",
    "What chapter does the Jujutsu Kaisen anime end on?",
    "Which Jujutsu Kaisen volume do I buy after the anime?",
    "Does the Jujutsu Kaisen anime cover the whole manga?",
  ]);
  // the page has already said where to start and what to buy
  expect(
    questions.filter((question) => question.shown).map((q) => q.shown),
  ).toEqual([
    "What chapter does each season end on?",
    "Does the anime cover the whole manga?",
  ]);
  // the latest season in a sentence, the earlier ones as short lines
  expect(questions[1]).toMatchObject({
    a: "Season 3 stops partway through chapter 181.",
    list: ["Season 2, chapter 137", "Season 1, chapter 63"],
  });
  expect(answerText(questions[1]!)).toBe(
    "Season 3 stops partway through chapter 181. Earlier: Season 2, chapter 137; Season 1, chapter 63.",
  );
  expect(questions[2]!.a).toBe(
    "Volume 21. The story carries on at chapter 181.",
  );
  expect(questions[3]!.a).toMatch(/^No\. /);
  // one season: no list of seasons worth showing
  const single = showQuestions({ ...show, stops: [first] });
  expect(single.filter((question) => question.shown)).toHaveLength(1);
  // nothing to ask about a show with no seasons
  expect(showQuestions({ ...show, stops: [] })).toEqual([]);
});

test("what a show's page says about itself", () => {
  expect(pageHeading("Jujutsu Kaisen", true)).toBe(
    "Jujutsu Kaisen: where to start the manga",
  );
  expect(pageHeading("Vagabond", false)).toBe("Vagabond: no answer yet");
  const meta = showMeta(show, false, "https://example.com")!;
  // the title is what people type into a search
  expect(meta.title).toBe(
    "Where does the Jujutsu Kaisen anime leave off in the manga?",
  );
  expect(meta.description).toMatch(
    /^After Season 3, start the manga at chapter 181\. Buy volume 21\./,
  );
  // the page's markup: its questions, and where it sits in the site
  const markup = showJsonLd(show, "https://example.com");
  expect(markup["@graph"][0]!.mainEntity).toHaveLength(4);
  expect(JSON.stringify(markup["@graph"][1])).toContain(
    "https://example.com/after-the-anime/jujutsu-kaisen",
  );
  // a show with no answer isn't one to find in a search
  expect(showMeta({ ...show, stops: [] }, false, "x")).toMatchObject({
    noindex: true,
  });
  // a name starting with "The" isn't said twice
  expect(
    showMeta({ ...show, name: "The Promised Neverland" }, false, "x")!.title,
  ).toBe("Where does the Promised Neverland anime leave off in the manga?");
});
