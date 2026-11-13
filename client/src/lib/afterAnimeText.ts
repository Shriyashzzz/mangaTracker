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

// "After Season 2", "After the anime"
export function afterLabel(stop: AnimeStop) {
  if (stop.label === "The anime") return "After the anime";
  return `After ${stop.label}`;
}

// the answer itself, said big
export function startText(stop: AnimeStop) {
  if (stop.coversAll) return "Nothing left to read";
  if (stop.nextChapter !== null) return `Start at chapter ${stop.nextChapter}`;
  if (stop.nextVolume !== null) return `Start with volume ${stop.nextVolume}`;
  if (stop.endVolume !== null) return `Pick up around volume ${stop.endVolume}`;
  return "We're not sure yet";
}

// the answer in one line, volume and all, for where there's no room for the
// volumes' cards: "Start at chapter 150, in volume 17 or 18". The next
// chapter's volume when it's known; otherwise the anime's last volume or the
// one after (see volumesToGet)
export function startTextWithVolume(stop: AnimeStop) {
  const start = startText(stop);
  // only a chapter needs its volume said: the other answers name one already
  if (stop.coversAll || stop.nextChapter === null) return start;
  if (stop.nextVolume !== null) return `${start}, in volume ${stop.nextVolume}`;
  if (stop.endVolume !== null)
    return `${start}, in volume ${stop.endVolume} or ${stop.endVolume + 1}`;
  return start;
}

// the series page's one short line: "Watched Season 2? Start at chapter 150,
// vol. 17 or 18."
export function shortLine(stop: AnimeStop) {
  const watched =
    stop.label === "The anime"
      ? "Watched the anime?"
      : `Watched ${stop.label}?`;
  const answer = startTextWithVolume(stop).replace(", in volume ", ", vol. ");
  return { watched, answer };
}

const inVolume = (volume: number | null) =>
  volume === null ? "" : `, in volume ${volume}`;

// where the season stops, as one sentence
export function endText(stop: AnimeStop) {
  const season = stop.label === "The anime" ? "The anime" : stop.label;
  if (stop.coversAll)
    return `${season} adapts the manga to its end, chapter ${stop.endChapter}${inVolume(stop.endVolume)}.`;
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

// the question the page answers, as people type it
export const showQuestion = (name: string) =>
  `Where does the ${name} anime leave off in the manga?`;

// one season in a sentence or two: "After Season 2: start at chapter 138.
// Season 2 ends at chapter 137, in volume 16."
export const seasonSentence = (stop: AnimeStop) =>
  `${afterLabel(stop)}: ${startText(stop).toLowerCase()}. ${endText(stop)}`.trim();

// schema.org's FAQPage for a show: its one question, answered season by
// season. The site's server writes the same (client/server.ts)
export const showJsonLd = (show: ShowForMeta) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: showQuestion(show.name),
      acceptedAnswer: {
        "@type": "Answer",
        text: show.stops.map(seasonSentence).join(" "),
      },
    },
  ],
});

// a show's page; null while it loads. A page with no answer isn't one to
// find in a search
export function showMeta(
  show: ShowForMeta | null,
  failed: boolean,
): ShowMeta | null {
  if (failed) return { title: "After the anime", noindex: true };
  if (!show) return null;
  const title = showQuestion(show.name);
  const path = `/after-the-anime/${show.slug}`;
  if (!show.stops.length) return { title, path, noindex: true };
  // the latest season is the one most people have just finished
  const latest = show.stops[show.stops.length - 1]!;
  const answer = startTextWithVolume(latest).toLowerCase();
  const season = latest.label === "The anime" ? "the anime" : latest.label;
  return {
    title,
    description: `After ${season} of ${show.name}, ${answer}. Every season's last chapter, the volume to buy next, and its cheapest price.`,
    path,
    image: show.coverUrl,
    jsonLd: showJsonLd(show),
  };
}
