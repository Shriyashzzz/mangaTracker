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

// MangaUpdates couldn't be asked about these a moment ago: they wait this
// long, so a page that's opened again and again doesn't ask every time
const RETRY_AFTER_MS = 10 * 60 * 1000;
const failedAt = new Map<string, number>();
// lookups running now, by series: a second page asking at the same moment
// waits for the first's answer
const asking = new Map<string, Promise<Saved | null>>();
type Saved = Awaited<ReturnType<typeof save>>;

// asks MangaUpdates and keeps its answer. `saved` is what we had
async function askAndKeep(series: Named, saved: Saved | null) {
  const slug = slugify(series.name);
  try {
    const lines = await getAnimeLines([
      series.name,
      ...(series.altNames ?? []),
    ]);
    // "not found" where we already hold an answer is far more likely the
    // search missing the series this time than the anime having vanished:
    // the answer stays, and isn't asked about again for a month
    if (!lines && saved?.endLine) {
      return await prisma.animeStops.update({
        where: { slug },
        data: { fetchedAt: new Date() },
      });
    }
    // "MangaUpdates doesn't know it" is an answer, kept like any other
    return await save(series.name, lines ?? NOTHING_KNOWN);
  } catch (e) {
    console.error("anime lines lookup failed:", (e as Error).message);
    failedAt.set(slug, Date.now());
    if (failedAt.size > 5_000) failedAt.delete(failedAt.keys().next().value!);
    return saved;
  }
}

// what's saved for the series, asking MangaUpdates first when there's
// nothing or it's old. `mayAsk` false (a crawler) reads the database only.
// When MangaUpdates can't be asked, the old answer stands; null when there
// has never been one
export async function animeLinesFor(series: Named, mayAsk: boolean) {
  const slug = slugify(series.name);
  const saved = await prisma.animeStops.findUnique({ where: { slug } });
  const fresh = saved && Date.now() - saved.fetchedAt.getTime() < FRESH_FOR_MS;
  if (fresh || !mayAsk) return saved;
  const failedLately = Date.now() - (failedAt.get(slug) ?? 0) < RETRY_AFTER_MS;
  if (failedLately) return saved;
  const running = asking.get(slug);
  if (running) return running;
  const lookup = askAndKeep(series, saved).finally(() => asking.delete(slug));
  asking.set(slug, lookup);
  return lookup;
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
