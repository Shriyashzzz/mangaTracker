// The words of the "after the anime" pages: for one season, what to start
// at, where it stops and which volume to buy; for a page, its heading, title
// and description. Pure rules with no imports at all, so the server's tests
// (tests/prices/afterAnimeText.test.ts) and the site's server
// (client/server.ts) can both use them.
//
// The rule behind the wording: say what to do, once, and only what's
// certain. One volume to buy, never "21 or 22".

// one season (or film, or OVA) and where it leaves the manga. The server's
// SentStop
export type AnimeStop = {
  // "Season 2", "Reze Movie", "Original series", or "The anime"
  label: string;
  endVolume: number | null;
  endChapter: number | null;
  // it stops partway through endChapter
  endsMidChapter: boolean;
  // the first chapter to read after it, and its volume when that's known
  nextChapter: number | null;
  nextVolume: number | null;
  // what else MangaUpdates says: "Skips Chap 80-81"
  note: string;
  // a reader's accepted correction is in it
  corrected: boolean;
  // it adapts the manga to its last chapter
  coversAll: boolean;
};

// ---------- one season ----------

// a panel's title: "After Season 2", "After the anime", "After the original
// series", or "After Reze Movie"
export function afterLabel(stop: AnimeStop) {
  if (stop.label === "The anime") return "After the anime";
  if (stop.label === "Original series") return "After the original series";
  return `After ${stop.label}`;
}

// the season as the subject of a sentence: "Season 2", "The anime"
const seasonSubject = (stop: AnimeStop) =>
  stop.label === "Original series" ? "The original series" : stop.label;

// the answer itself, said big
export function startText(stop: AnimeStop) {
  if (stop.coversAll) return "That's the whole story";
  if (stop.nextChapter !== null) return `Start at chapter ${stop.nextChapter}`;
  if (stop.nextVolume !== null) return `Start with volume ${stop.nextVolume}`;
  if (stop.endVolume !== null) return `Start with volume ${stop.endVolume}`;
  return "We're not sure yet";
}

// the one volume to buy to carry on; null when there's nothing to carry on
// with, or no volume on record. The volume the next chapter is in, when
// that's known. Otherwise the volume the anime ends in: starting there never
// skips a chapter (at worst a few are read twice), so it's the safe pick
export function buyVolume(stop: AnimeStop) {
  if (stop.coversAll) return null;
  return stop.nextVolume ?? stop.endVolume;
}

// the volume after the one to buy, offered quietly when the pick was the
// anime's last volume: someone who already has that one wants this. Null
// otherwise
export function volumeAfter(stop: AnimeStop) {
  if (stop.coversAll || stop.nextVolume !== null) return null;
  return stop.endVolume === null ? null : stop.endVolume + 1;
}

// why the volume to buy is that one, in a few words
export function whyThisVolume(stop: AnimeStop) {
  if (stop.nextVolume !== null && stop.nextChapter !== null)
    return `Chapter ${stop.nextChapter} is in this volume.`;
  if (stop.nextVolume !== null) return "Start here.";
  return "The anime ends in this volume, so you miss nothing.";
}

// where the season stops, as one sentence. Its volume is said only when it's
// the volume to buy too: "ends in volume 11" beside a card for volume 12
// reads as a mistake
export function endText(stop: AnimeStop) {
  const season = seasonSubject(stop);
  if (stop.coversAll)
    return `${season} covers the manga to its final chapter, ${stop.endChapter}.`;
  if (stop.endChapter === null) {
    if (stop.endVolume !== null)
      return `${season} ends in volume ${stop.endVolume}.`;
    // a correction that only names the volume to start from
    return "";
  }
  const sameVolume =
    stop.endVolume !== null && stop.endVolume === buyVolume(stop);
  const inVolume = sameVolume ? `, in volume ${stop.endVolume}` : "";
  if (stop.endsMidChapter)
    return `${season} stops partway through chapter ${stop.endChapter}${inVolume}.`;
  return `${season} ends at chapter ${stop.endChapter}${inVolume}.`;
}

// where someone who watched the season is in the manga, for their shelf: the
// last chapter it covered, and the last volume it covered all of. Null for
// what the season doesn't say
export function placeAfter(stop: AnimeStop) {
  let chapter: number | null = null;
  if (stop.endChapter !== null)
    // a chapter it stopped partway through isn't read yet
    chapter = stop.endsMidChapter
      ? Math.max(0, Math.floor(stop.endChapter) - 1)
      : Math.floor(stop.endChapter);
  // the volume to start in is known: every one before it is done. When only
  // the last volume is, it may be half covered, so that one isn't counted
  const startsIn = stop.nextVolume ?? stop.endVolume;
  const volume = startsIn === null ? null : Math.max(0, startsIn - 1);
  return { chapter, volume };
}

// a panel's heading, with the words people search: "After Season 2: start
// at chapter 138"
export const seasonHeading = (stop: AnimeStop) =>
  `${afterLabel(stop)}: ${startText(stop).toLowerCase()}`;

// where on the page a season's panel is, for the table's links
export const seasonAnchor = (stop: AnimeStop) =>
  `after-${stop.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

// one season's answer in plain sentences, for the copy of the page search
// engines read: "Season 2 ends at chapter 137, in volume 16. Start the manga
// at chapter 138. Buy volume 16."
export function answerSentence(stop: AnimeStop) {
  const where = endText(stop);
  if (stop.coversAll || stop.nextChapter === null) return where;
  const volume = buyVolume(stop);
  const buy = volume === null ? "" : ` Buy volume ${volume}.`;
  return `${where} Start the manga at chapter ${stop.nextChapter}.${buy}`.trim();
}

// a season as a row of the page's table: "You watched", "Start at chapter",
// "Buy volume". An empty string is something the season doesn't have
export function tableRow(stop: AnimeStop) {
  const volume = buyVolume(stop);
  let start = "";
  if (stop.coversAll) start = "Nothing left to read";
  else if (stop.nextChapter !== null) start = String(stop.nextChapter);
  return {
    watched: seasonSubject(stop),
    start,
    volume: volume === null ? "" : String(volume),
  };
}

// ---------- the page's opening answer ----------

// the season most people have just finished: the last one listed
export const latestStop = (stops: AnimeStop[]) => stops[stops.length - 1];

// The page's opening answer, for the latest season: the one most people
// have just finished. It opens with a question, because someone arriving
// from a search hasn't told us what they've watched. Three short lines:
//   asked:  "Finished the anime?"
//   lead:   "Start the manga at chapter 116. Buy volume 24."
//   detail: "Season 3 is the latest, and it ends at chapter 115."
export function latestAnswer(stop: AnimeStop) {
  const asked = "Finished the anime?";
  // "Season 3 is the latest, and it ends at…", or just "The anime ends at…"
  const subject =
    stop.label === "The anime"
      ? "The anime"
      : `${seasonSubject(stop)} is the latest, and it`;
  if (stop.coversAll)
    return {
      asked,
      lead: "You've seen the whole story.",
      detail: `${subject} ends at the manga's final chapter, ${stop.endChapter}.`,
    };
  const volume = buyVolume(stop);
  if (stop.nextChapter !== null) {
    const buy = volume === null ? "" : ` Buy volume ${volume}.`;
    const how = stop.endsMidChapter ? "stops partway through" : "ends at";
    return {
      asked,
      lead: `Start the manga at chapter ${stop.nextChapter}.${buy}`,
      detail: `${subject} ${how} chapter ${stop.endChapter}.`,
    };
  }
  if (volume !== null)
    return {
      asked,
      lead: `Start the manga at volume ${volume}.`,
      detail: `${subject} ends in volume ${stop.endVolume ?? volume}.`,
    };
  return { asked: "", lead: "", detail: "" };
}

// the same answer as one piece of text, for a description or FAQ markup
export function latestAnswerText(stop: AnimeStop) {
  const { asked, lead, detail } = latestAnswer(stop);
  return `${asked} ${lead} ${detail}`.trim();
}

// ---------- what a page says about itself (heading, title, description) ----------

// a show, as much of it as its title and description need
type ShowForMeta = {
  name: string;
  slug: string;
  coverUrl: string | null;
  stops: AnimeStop[];
};

// fits the app's PageMeta (lib/seo.ts)
type ShowMeta = {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
};

export const INDEX_META = {
  title: "Where does the anime leave off in the manga?",
  description:
    "Finished a season? Look up the anime and see which manga chapter and volume to start from, with the cheapest price for that volume.",
  path: "/after-the-anime",
};

// "the Promised Neverland anime", never "the The Promised Neverland anime"
export const withoutThe = (name: string) => name.replace(/^the\s+/i, "");
const theAnime = (name: string) => `the ${withoutThe(name)} anime`;

// the question the page answers, as people type it into a search: the
// page's title in a search result, not its heading
export const showQuestion = (name: string) =>
  `Where does ${theAnime(name)} leave off in the manga?`;

// the page's own heading: plain, with the series first
export const pageHeading = (name: string, hasAnswer: boolean) =>
  hasAnswer ? `${name}: where to start the manga` : `${name}: no answer yet`;

// "Season 2 ends at chapter 137." for the list of every season's last
// chapter; "" for a season with no chapter on record
function endsAtChapter(stop: AnimeStop) {
  if (stop.endChapter === null) return "";
  const season = seasonSubject(stop);
  if (stop.endsMidChapter)
    return `${season} stops partway through chapter ${stop.endChapter}.`;
  if (stop.coversAll)
    return `${season} ends at chapter ${stop.endChapter}, the manga's last.`;
  return `${season} ends at chapter ${stop.endChapter}.`;
}

// a question and its answer. `q` is how people type it into a search, and
// goes in the page's markup. `shown` is the short way the page itself asks
// it; a question with none isn't shown, because the page has already
// answered it above. `list`: more of the answer as short lines, one a season
export type ShowQuestion = {
  q: string;
  shown?: string;
  a: string;
  list?: string[];
};

// an answer as one piece of text, for markup that takes no lists
export const answerText = ({ a, list }: ShowQuestion) =>
  list?.length ? `${a} Earlier: ${list.join("; ")}.` : a;

// the questions a show's page answers. Only the ones this show has an
// answer to
export function showQuestions(show: ShowForMeta): ShowQuestion[] {
  const latest = latestStop(show.stops);
  if (!latest) return [];
  const earlier = show.stops
    .filter((stop) => stop !== latest && stop.endChapter !== null)
    .reverse()
    .map((stop) => `${seasonSubject(stop)}, chapter ${stop.endChapter}`);
  const questions: ShowQuestion[] = [
    { q: showQuestion(show.name), a: latestAnswerText(latest) },
    {
      q: `What chapter does ${theAnime(show.name)} end on?`,
      // worth showing only when there are earlier seasons to list
      ...(earlier.length
        ? { shown: "What chapter does each season end on?" }
        : {}),
      // the latest season in a sentence, the ones before it as a short list
      a: endsAtChapter(latest),
      list: earlier,
    },
  ];
  const volume = buyVolume(latest);
  if (volume !== null && latest.nextChapter !== null)
    questions.push({
      q: `Which ${show.name} volume do I buy after the anime?`,
      a: `Volume ${volume}. The story carries on at chapter ${latest.nextChapter}.`,
    });
  if (latest.endChapter !== null)
    questions.push({
      q: `Does ${theAnime(show.name)} cover the whole manga?`,
      shown: "Does the anime cover the whole manga?",
      a: latest.coversAll
        ? `Yes. ${endText(latest)}`
        : `No. ${endText(latest)} The manga carries on from there.`,
    });
  return questions.filter((question) => question.a);
}

// schema.org markup for a show: its questions and answers, and where the
// page sits in the site. `origin`: the site's own address. The site's server
// writes the same (client/server.ts)
export const showJsonLd = (show: ShowForMeta, origin: string) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: showQuestions(show).map((question) => ({
        "@type": "Question",
        name: question.q,
        acceptedAnswer: { "@type": "Answer", text: answerText(question) },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        ["After the anime", "/after-the-anime"],
        [show.name, `/after-the-anime/${show.slug}`],
      ].map(([name, path], at) => ({
        "@type": "ListItem",
        position: at + 1,
        name,
        item: origin + path,
      })),
    },
  ],
});

// a show's page; null while it loads. A page with no answer isn't one to
// find in a search
export function showMeta(
  show: ShowForMeta | null,
  failed: boolean,
  origin: string,
): ShowMeta | null {
  if (failed) return { title: "After the anime", noindex: true };
  if (!show) return null;
  const title = showQuestion(show.name);
  const path = `/after-the-anime/${show.slug}`;
  if (!show.stops.length) return { title, path, noindex: true };
  const latest = latestStop(show.stops)!;
  return {
    title,
    // the answer itself, so it can be read off the search result
    description: `${latestAnswerText(latest)} Every season's last chapter, the volume to buy next and its price.`,
    path,
    image: show.coverUrl,
    jsonLd: showJsonLd(show, origin),
  };
}
