// the words the client says on the "after the anime" pages
// (client/src/lib/afterAnimeText.ts), over what the server's reader makes of
// real MangaUpdates lines
import {
  bookAfter,
  bookFor,
  bookShort,
  bookWords,
} from "../../../../client/src/pages/AfterAnime/bookFor.js";
import type { SeriesVolume } from "../../../../client/src/lib/types.js";
import {
  afterLabel,
  answerSentence,
  answerText,
  buyVolume,
  catchUp,
  endText,
  keepNumbers,
  latestAnswer,
  latestAnswerText,
  latestStop,
  leftLine,
  pageHeading,
  priceLine,
  placeAfter,
  showJsonLd,
  showMeta,
  showQuestions,
  startText,
  tableRow,
  volumeAfter,
  whyThisVolume,
  type AnimeStop,
  type SavedBook,
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
  expect(latestAnswer(only!).lead).toBe("Start the manga at volume 18.");
});

test("an anime that adapts all of it has nothing left to read", () => {
  expect(startText(finished)).toBe("That's the whole story");
  expect(endText(finished)).toBe(
    "Season 1 covers the manga to its final chapter, 271.",
  );
  expect(latestAnswer(finished)).toEqual({
    asked: "Finished the anime?",
    lead: "You've seen the whole story.",
    detail:
      "Season 1 is the latest, and it ends at the manga's final chapter, 271.",
  });
});

test("the page's opening answer says what to do, then where the anime stops", () => {
  expect(latestAnswer(second)).toEqual({
    asked: "Finished the anime?",
    lead: "Start the manga at chapter 138. Buy volume 16.",
    detail: "Season 2 is the latest, and it ends at chapter 137.",
  });
  expect(latestAnswer(third)).toEqual({
    asked: "Finished the anime?",
    lead: "Start the manga at chapter 181. Buy volume 21.",
    detail: "Season 3 is the latest, and it stops partway through chapter 181.",
  });
  const [chaptersOnly] = shown("Chap 0 (S1)", "Chap 45 (S1)");
  expect(latestAnswer(chaptersOnly!).lead).toBe(
    "Start the manga at chapter 46.",
  );
  expect(latestAnswerText(second)).toBe(
    "Finished the anime? Start the manga at chapter 138. Buy volume 16. Season 2 is the latest, and it ends at chapter 137.",
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
    /^Finished the anime\? Start the manga at chapter 181\. Buy volume 21\./,
  );
  // the question is the whole title, and the description fits a search
  // result: what else the page has is said only when there's room
  expect(meta.fullTitle).toBe(true);
  expect(meta.description!.length).toBeLessThanOrEqual(160);
  const long = showMeta(
    {
      ...show,
      stops: show.stops.map((stop) => ({
        ...stop,
        label: "Thousand-Year Blood War the Calamity part four",
      })),
    },
    false,
    "x",
  )!;
  expect(long.description).not.toContain("Every season");
  expect(long.description).toMatch(/^Finished the anime\?/);
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

test("a number stays on the line of the word it belongs to", () => {
  const kept = keepNumbers(
    "After Season 3, start at chapter 181. Buy volume 21.",
  );
  // no-break spaces, in the three places a line could split
  expect(kept).toBe(
    "After Season\u00a03, start at chapter\u00a0181. Buy volume\u00a021.",
  );
  expect(keepNumbers("its final chapter, 431.")).toBe(
    "its final chapter,\u00a0431.",
  );
  expect(keepNumbers("No numbers here")).toBe("No numbers here");
});

test("the latest season is the one furthest into the manga, not the last listed", () => {
  // a film listed after the newest season, as MangaUpdates sometimes has it
  const stops = shown(
    "",
    "Vol 5, Chap 38 (S1) / Vol 12, Chap 97 (S2) / Vol 6, Chap 52 (Movie)",
  );
  expect(latestStop(stops)?.label).toBe("Season 2");
  // in the usual order it's the last one
  const inOrder = shown("", "Vol 5, Chap 38 (S1) / Vol 12, Chap 97 (S2)");
  expect(latestStop(inOrder)?.label).toBe("Season 2");
  // with no chapters to go by, the last one listed
  const volumesOnly = shown("", "Vol 5 (S1) / Vol 12 (S2)");
  expect(latestStop(volumesOnly)?.label).toBe("Season 2");
  expect(latestStop([])).toBeUndefined();
});

test('a season named by a plain word gets its "the"', () => {
  const stops = shown(
    "",
    "Vol 5, Chap 46 (S1) / Vol 16, Chap 160 (Movie) / Vol 6, Chap 52 (Reze Movie) / Vol 7, Chap 60 (OVA)",
  );
  const [season, movie, named, ova] = stops;
  // never "Movie is the latest"
  expect(latestAnswer(movie!).detail).toBe(
    "The movie is the latest, and it ends at chapter 160.",
  );
  expect(afterLabel(movie!)).toBe("After the movie");
  expect(tableRow(movie!).watched).toBe("The movie");
  expect(afterLabel(ova!)).toBe("After the OVA");
  // a name is left as it is
  expect(afterLabel(named!)).toBe("After Reze Movie");
  expect(afterLabel(season!)).toBe("After Season 1");
});

// Vinland Saga in English: only Kodansha's books of two (Book 7 holds 13–14)
const books: SeriesVolume[] = [13, 14, 15, 16].map((volume) => {
  const book = volume <= 14 ? 7 : 8;
  return {
    isbn13: `97816323600${book}0`,
    title: `Vinland Saga, Book ${book}`,
    volume,
    coverUrl: "",
    knownPriceCents: null,
    inBook: { book, from: book * 2 - 1, to: book * 2 },
  };
});

test("a volume sold only in a book of two: the book is the one to buy", () => {
  const book = bookFor(books, 14);
  expect(book?.title).toBe("Vinland Saga, Book 7");
  expect(bookWords(book, 14)).toBe("Book 7 (vols. 13–14)");
  expect(bookShort(book, 14)).toBe("Book 7");
  // the one after Book 7 is Book 8, even from its first volume
  expect(bookAfter(books, 13)?.title).toBe("Vinland Saga, Book 8");
  // a volume sold on its own is still called a volume
  const single = { ...books[0]!, inBook: undefined, volume: 3 };
  expect(bookFor([single], 3)).toBe(single);
  expect(bookWords(single, 3)).toBe("volume 3");
  // the page's answer says the book; the search engines' copy, the volume
  expect(latestAnswer(third!, () => "Book 7 (vols. 13–14)").lead).toMatch(
    /Buy Book 7 \(vols\. 13–14\)\.$/,
  );
  expect(latestAnswer(third!).lead).toMatch(/Buy volume \d+\.$/);
});

// ---------- buying: the price, and what's left ----------

// times from the real clock (no fixed dates): the page is given its "now"
const NOW = new Date();
const daysBack = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
// Jujutsu Kaisen's volumes 19 to 24, each $9.59 at Books-A-Million and
// checked four days ago
const priced = (volume: number, cents: number | null = 959): SavedBook => ({
  volume,
  isbn13: `97819747${String(volume).padStart(5, "0")}`,
  cents,
  store: cents === null ? null : "Books-A-Million",
  checkedAt: cents === null ? null : daysBack(4),
});
const jjkBooks = [19, 20, 21, 22, 23, 24].map((v) => priced(v));
const running = { finished: false, volumes: null };

test("the volume to buy and its saved price, as a sentence", () => {
  expect(priceLine(third, jjkBooks, NOW)).toBe(
    "Volume 21 is $9.59 new at Books-A-Million, checked 4 days ago.",
  );
  expect(
    priceLine(third, [{ ...priced(21), checkedAt: daysBack(0) }], NOW),
  ).toBe("Volume 21 is $9.59 new at Books-A-Million, checked today.");
  expect(
    priceLine(third, [{ ...priced(21), checkedAt: daysBack(1) }], NOW),
  ).toBe("Volume 21 is $9.59 new at Books-A-Million, checked yesterday.");
  // nothing is said without a saved price, for another volume's, or for one
  // too old to quote
  expect(priceLine(third, [priced(21, null)], NOW)).toBe("");
  expect(priceLine(third, [priced(20)], NOW)).toBe("");
  expect(
    priceLine(third, [{ ...priced(21), checkedAt: daysBack(45) }], NOW),
  ).toBe("");
  expect(priceLine(finished, jjkBooks, NOW)).toBe("");
});

test("what's left after the anime: the volumes out, and all of them priced", () => {
  expect(catchUp(third, jjkBooks)).toEqual({
    from: 21,
    to: 24,
    count: 4,
    unbroken: true,
    cents: 4 * 959,
  });
  expect(leftLine(third, running, jjkBooks)).toBe(
    "The manga is still running. Volumes 21 to 24 are out in English: 4 to catch up. All 4 cost $38.36 new.",
  );
  expect(leftLine(third, { finished: true, volumes: 30 }, jjkBooks)).toBe(
    "The manga is finished at 30 volumes. Volumes 21 to 24 are out in English: 4 to catch up. All 4 cost $38.36 new.",
  );
});

test("a total is never said with a price missing, and gaps aren't called a run", () => {
  const onePriceShort = [priced(21), priced(22, null), priced(23), priced(24)];
  expect(catchUp(third, onePriceShort)?.cents).toBeNull();
  expect(leftLine(third, running, onePriceShort)).toBe(
    "The manga is still running. Volumes 21 to 24 are out in English: 4 to catch up.",
  );
  // volume 23 isn't in the list
  expect(leftLine(third, running, [priced(21), priced(22), priced(24)])).toBe(
    "The manga is still running. 3 volumes from volume 21 on are out in English. All 3 cost $28.77 new.",
  );
  // only the one to buy is out
  expect(leftLine(third, running, [priced(20), priced(21)])).toBe(
    "The manga is still running. Volume 21 is the one out in English after the anime.",
  );
  // the volume to buy isn't out in English, or the anime told it all
  expect(leftLine(third, running, [priced(19), priced(20)])).toBe("");
  expect(leftLine(third, running, [priced(22), priced(23)])).toBe("");
  expect(leftLine(finished, running, jjkBooks)).toBe("");
});

test("a show's description leads with the price when one is saved and it fits", () => {
  const show = {
    name: "Jujutsu Kaisen",
    slug: "jujutsu-kaisen",
    coverUrl: null,
    stops: [first, second, third],
  };
  const plain = showMeta(show, false, "https://example.com", NOW)!;
  const withPrice = showMeta(
    { ...show, books: jjkBooks, manga: running, checkedAt: daysBack(2) },
    false,
    "https://example.com",
    NOW,
  )!;
  expect(plain.description).not.toContain("$");
  // with the price it's the answer and the price, if both fit; never cut
  const answer = latestAnswerText(third);
  const price = priceLine(third, jjkBooks, NOW);
  expect(withPrice.description).toBe(
    `${answer} ${price}`.length <= 160
      ? `${answer} ${price}`
      : plain.description,
  );
  // and the page's questions say what's left, with the date it was checked
  const questions = showQuestions({ ...show, books: jjkBooks, manga: running });
  expect(
    questions.find(
      (q) =>
        q.q === "How many Jujutsu Kaisen volumes are left after the anime?",
    )?.a,
  ).toBe(leftLine(third, running, jjkBooks));
  expect(showQuestions(show).some((q) => /volumes are left/.test(q.q))).toBe(
    false,
  );
  const faq = (
    showJsonLd({ ...show, checkedAt: daysBack(2) }, "https://example.com")[
      "@graph"
    ] as Record<string, unknown>[]
  )[0]!;
  expect(faq.dateModified).toBe(daysBack(2));
});

// ---------- why a show has no answer ----------
test("a show with no answer says why, and only what's certain", async () => {
  const { noAnswerLine } =
    await import("../../../../client/src/lib/afterAnimeText.js");
  // Overgeared, November 2026: 12 episodes planned, not all out
  expect(noAnswerLine("Overgeared", { state: "airing", episodes: 12 })).toBe(
    "The Overgeared anime is still airing, 12 episodes in all. It has no last chapter until it ends.",
  );
  expect(noAnswerLine("Overgeared", { state: "airing", episodes: null })).toBe(
    "The Overgeared anime is still airing. It has no last chapter until it ends.",
  );
  expect(
    noAnswerLine("Sakamoto Days", { state: "upcoming", episodes: null }),
  ).toBe("The Sakamoto Days anime hasn't started yet.");
  // "The The Promised Neverland anime" is never said
  expect(
    noAnswerLine("The Promised Neverland", { state: "ended", episodes: null }),
  ).toBe(
    "The Promised Neverland anime has ended, but nobody has recorded where it leaves off.",
  );
  expect(noAnswerLine("Vagabond", { state: "none", episodes: null })).toBe(
    "We know of no anime for Vagabond.",
  );
  // a series saved before its anime was asked about: no reason is made up
  expect(noAnswerLine("Vagabond", null)).toBe(
    "We have no answer for Vagabond yet.",
  );
});
