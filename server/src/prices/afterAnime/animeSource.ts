// MangaUpdates' word on where a series' anime leaves off, kept in the
// database (anime_stops) so a page costs it nothing: asked once, then again
// after a month. The release checks already fetch the same record for a
// shelf's series (sources/mangaUpdates.ts), and every one of those is kept
// here too, so most series are known before anyone opens their page.
import { prisma } from "../../config/prisma.js";
import { slugify } from "../stores/match.js";
import {
  getAnimeLines,
  onAnimeLines,
  type AnimeLines,
} from "../sources/mangaUpdates.js";

// an anime gets a new season a few times a year at most
const FRESH_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const NOTHING_KNOWN: AnimeLines = {
  startLine: null,
  endLine: null,
  lastChapter: null,
  completed: false,
  sourceUrl: null,
};

function save(name: string, lines: AnimeLines) {
  const slug = slugify(name);
  const row = { name, ...lines, fetchedAt: new Date() };
  return prisma.animeStops.upsert({
    where: { slug },
    create: { slug, ...row },
    update: row,
  });
}

// a series as much as this needs: its own name and the others it goes by
type Named = { name: string; altNames?: string[] };

// what's saved for the series, asking MangaUpdates first when there's
// nothing or it's old. `mayAsk` false (a crawler) reads the database only.
// When MangaUpdates can't be asked, the old answer stands; null when there
// has never been one
export async function animeLinesFor(series: Named, mayAsk: boolean) {
  const slug = slugify(series.name);
  const saved = await prisma.animeStops.findUnique({ where: { slug } });
  const fresh = saved && Date.now() - saved.fetchedAt.getTime() < FRESH_FOR_MS;
  if (fresh || !mayAsk) return saved;
  try {
    const lines = await getAnimeLines([
      series.name,
      ...(series.altNames ?? []),
    ]);
    // "MangaUpdates doesn't know it" is an answer, kept like any other
    return await save(series.name, lines ?? NOTHING_KNOWN);
  } catch (e) {
    console.error("anime lines lookup failed:", (e as Error).message);
    return saved;
  }
}

// a release check just fetched a series' record: its anime lines are kept,
// under the series' own name when the name asked for is one we know
async function keepFromReleaseCheck(names: string[], lines: AnimeLines) {
  const asked = names[0];
  if (!asked) return;
  const known = await prisma.seriesInfo.findUnique({
    where: { slug: slugify(asked) },
  });
  const name = (known?.info as { name?: string } | null)?.name;
  if (name) await save(name, lines);
}

onAnimeLines((names, lines) => {
  keepFromReleaseCheck(names, lines).catch((e) =>
    console.error("keeping anime lines failed:", (e as Error).message),
  );
});
