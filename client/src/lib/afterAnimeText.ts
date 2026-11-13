// The words of the "after the anime" pages: for one season, what to start
// at, where it stops and which volumes to get; for a page, its title and
// description. Pure rules with no imports at all, so the server's tests
// (tests/prices/afterAnimeText.test.ts) and the site's server
// (client/server.ts) can both use them.

// one season (or film, or OVA) and where it leaves the manga. The server's
// SentStop
export type AnimeStop = {
  // "Season 2", "Reze Movie", or "The anime"
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

// a panel's title: "After Season 2 of the anime", "After the anime", or
// "After Reze Movie" for anything that isn't a numbered season
export function afterLabel(stop: AnimeStop) {
  if (stop.label === "The anime") return "After the anime";
  if (stop.label.startsWith("Season "))
    return `After ${stop.label} of the anime`;
  return `After ${stop.label}`;
}

// the answer itself, said big
export function startText(stop: AnimeStop) {
  if (stop.coversAll) return "You've seen the whole story";
  if (stop.nextChapter !== null) return `Start at chapter ${stop.nextChapter}`;
  if (stop.nextVolume !== null) return `Start with volume ${stop.nextVolume}`;
  if (stop.endVolume !== null) return `Pick up around volume ${stop.endVolume}`;
  return "We're not sure yet";
}

const inVolume = (volume: number | null) =>
  volume === null ? "" : `, in volume ${volume}`;

// where the season stops, as one sentence
export function endText(stop: AnimeStop) {
  const season = stop.label === "The anime" ? "The anime" : stop.label;
  if (stop.coversAll) {
    const volume = stop.endVolume === null ? "" : `, volume ${stop.endVolume}`;
    return `${season} covers the manga right to its final chapter (${stop.endChapter}${volume}). There's nothing new to read after it.`;
  }
  if (stop.endChapter === null) {
    if (stop.endVolume !== null)
      return `${season} ends in volume ${stop.endVolume}.`;
    // a correction that only names the volume to start from
    return "";
  }
  if (stop.endsMidChapter)
    return `${season} stops partway through chapter ${stop.endChapter}${inVolume(stop.endVolume)}.`;
  return `${season} ends at chapter ${stop.endChapter}${inVolume(stop.endVolume)}.`;
}

// a volume worth buying to carry on, and why it's that one
export type VolumeToGet = { volume: number; why: string };

// the volume the next chapter is in, when that's known. When only the
// anime's last volume is, that one and the one after: the next chapter is in
// one of the two
export function volumesToGet(stop: AnimeStop): VolumeToGet[] {
  if (stop.coversAll) return [];
  if (stop.nextVolume !== null) {
    const why =
      stop.nextChapter === null
        ? "Start here"
        : `Chapter ${stop.nextChapter} is in this one`;
    return [{ volume: stop.nextVolume, why }];
  }
  if (stop.endVolume === null) return [];
  return [
    { volume: stop.endVolume, why: "The anime ends in this one" },
    { volume: stop.endVolume + 1, why: "The one after" },
  ];
}

// said under two volumes, so it's clear why there are two
export function twoVolumesNote(stop: AnimeStop) {
  if (stop.nextVolume !== null || stop.endVolume === null || stop.coversAll)
    return "";
  const chapter =
    stop.nextChapter === null
      ? "The next chapter"
      : `Chapter ${stop.nextChapter}`;
  return `${chapter} is in volume ${stop.endVolume} or ${stop.endVolume + 1}: it depends on whether the anime ended partway through a volume.`;
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

// ---------- what a page says about itself (title, description) ----------

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

// the question the page answers, as people type it
export const showQuestion = (name: string) =>
  `Where does ${theAnime(name)} leave off in the manga?`;

// the season most people have just finished: the last one listed
export const latestStop = (stops: AnimeStop[]) => stops[stops.length - 1];

// a panel's heading, with the words people search: "After Season 2: start
// at chapter 138"
export const seasonHeading = (stop: AnimeStop) =>
  `${afterLabel(stop)}: ${startText(stop).toLowerCase()}`;

// one season in a sentence or two: "After Season 2: start at chapter 138.
// Season 2 ends at chapter 137, in volume 16."
export const seasonSentence = (stop: AnimeStop) =>
  `${seasonHeading(stop)}. ${endText(stop)}`.trim();

// where on the page a season's panel is, for the table's links
export const seasonAnchor = (stop: AnimeStop) =>
  `after-${stop.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

// the volume the next chapter is in, as a few words: "16", "17 or 18", ""
function volumeWords(stop: AnimeStop) {
  if (stop.coversAll) return "";
  if (stop.nextVolume !== null) return String(stop.nextVolume);
  if (stop.endVolume !== null)
    return `${stop.endVolume} or ${stop.endVolume + 1}`;
  return "";
}

// one season's answer in plain sentences, for the copy of the page search
// engines read: "Season 2 ends at chapter 137, in volume 16.
// To carry on with the story, start the manga at chapter 138, in volume 16."
export function answerSentence(stop: AnimeStop) {
  const where = endText(stop);
  // the end's own sentence already says there's nothing after it
  if (stop.coversAll) return where;
  if (stop.nextChapter === null) return where;
  const volume = volumeWords(stop);
  const inWhich = volume ? `, in volume ${volume}` : "";
  return `${where} To carry on with the story, start the manga at chapter ${stop.nextChapter}${inWhich}.`.trim();
}

// the page's opening answer, for someone who has watched everything out so
// far. Three short pieces, each on its own line:
//   asked:  "Caught up on the anime?"
//   lead:   "Start the manga at chapter 116, volume 24 or 25."
//   detail: "Season 3 part 1 is the latest, and it ends at chapter 115."
export function latestAnswer(stop: AnimeStop) {
  const asked = "Caught up on the anime?";
  // "Season 3 is the latest, and it ends at…", or just "The anime ends at…"
  const subject =
    stop.label === "The anime"
      ? "The anime"
      : `${stop.label} is the latest, and it`;
  if (stop.coversAll)
    return {
      asked,
      lead: "You've seen the whole story.",
      detail: `${subject} covers the manga to its final chapter, ${stop.endChapter}.`,
    };
  if (stop.nextChapter !== null) {
    const volume = volumeWords(stop);
    const inWhich = volume ? `, volume ${volume}` : "";
    const how = stop.endsMidChapter ? "stops partway through" : "ends at";
    return {
      asked,
      lead: `Start the manga at chapter ${stop.nextChapter}${inWhich}.`,
      detail: `${subject} ${how} chapter ${stop.endChapter}.`,
    };
  }
  if (stop.endVolume !== null)
    return {
      asked,
      lead: `Pick up the manga around volume ${stop.endVolume}.`,
      detail: `${subject} ends in volume ${stop.endVolume}.`,
    };
  return { asked: "", lead: "", detail: "" };
}

// the same answer as one piece of text, for a description or FAQ markup
export function latestAnswerText(stop: AnimeStop) {
  const { asked, lead, detail } = latestAnswer(stop);
  return `${asked} ${lead} ${detail}`.trim();
}

// a season as a row of the page's table: "If you watched", "Start reading
// at", "Volume". An empty string is something the season doesn't say
export function tableRow(stop: AnimeStop) {
  let start = "";
  if (stop.coversAll) start = "You've seen it all";
  else if (stop.nextChapter !== null) start = `Chapter ${stop.nextChapter}`;
  // nothing to carry on with, so the volumes are the whole run: "All 42"
  let volume = volumeWords(stop);
  if (stop.coversAll)
    volume = stop.endVolume === null ? "All of them" : `All ${stop.endVolume}`;
  return { watched: stop.label, start, volume };
}

// "Season 2 ends at chapter 137." for the list of every season's last
// chapter; "" for a season with no chapter on record
function endsAtChapter(stop: AnimeStop) {
  if (stop.endChapter === null) return "";
  const season = stop.label === "The anime" ? "The anime" : stop.label;
  if (stop.endsMidChapter)
    return `${season} stops partway through chapter ${stop.endChapter}.`;
  if (stop.coversAll)
    return `${season} ends at chapter ${stop.endChapter}, the manga's last.`;
  return `${season} ends at chapter ${stop.endChapter}.`;
}

// a question and its answer. `list`: more of the answer as short lines, one
// a season, so a long show's answer isn't one run-on paragraph
export type ShowQuestion = { q: string; a: string; list?: string[] };

// an answer as one piece of text, for markup that takes no lists
export const answerText = ({ a, list }: ShowQuestion) =>
  list?.length ? `${a} Earlier: ${list.join("; ")}.` : a;

// the questions a show's page answers, as people type them. Only the ones
// this show has an answer to
export function showQuestions(show: ShowForMeta): ShowQuestion[] {
  const latest = latestStop(show.stops);
  if (!latest) return [];
  const questions: ShowQuestion[] = [
    { q: showQuestion(show.name), a: latestAnswerText(latest) },
    {
      q: `What chapter does ${theAnime(show.name)} end on?`,
      // the latest season in a sentence, the ones before it as a short list
      a: endsAtChapter(latest),
      list: show.stops
        .filter((stop) => stop !== latest && stop.endChapter !== null)
        .reverse()
        .map((stop) => `${stop.label}, chapter ${stop.endChapter}`),
    },
  ];
  const volume = volumeWords(latest);
  if (volume && latest.nextChapter !== null)
    questions.push({
      q: `Which ${show.name} volume do I buy after the anime?`,
      a: `After ${latest.label === "The anime" ? "the anime" : latest.label}, the story carries on at chapter ${latest.nextChapter}, which is in volume ${volume}.`,
    });
  if (latest.endChapter !== null)
    questions.push({
      q: `Does ${theAnime(show.name)} cover the whole manga?`,
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
