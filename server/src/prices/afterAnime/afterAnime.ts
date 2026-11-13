// "Where does the anime leave off?" for one series, and the list of every
// series we can answer it for. What MangaUpdates says (animeSource.ts), read
// into seasons (animeLines.ts), with readers' accepted corrections over it
// (animeFixes.ts).
import { prisma } from "../../config/prisma.js";
import { isNovelName } from "../lightNovel.js";
import {
  getSeriesInfo,
  knownSeriesName,
  listKnownSeries,
} from "../sources/anilist.js";
import { slugify } from "../stores/match.js";
import type { SeriesInfo } from "../types.js";
import { withFixes, type ShownStop } from "./animeFixes.js";
import { reachesTheEnd, readAnimeStops, type MangaEnd } from "./animeLines.js";
import { animeLinesFor } from "./animeSource.js";
import { acceptedFixes, slugsWithFixes } from "./fixStore.js";

// a season as it's sent: `coversAll` when it adapts the manga to its end, so
// there's nothing left to read (reachesTheEnd)
export type SentStop = ShownStop & { coversAll: boolean };

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// the series as it's saved, without asking AniList; null when it isn't
async function savedSeriesInfo(name: string) {
  const saved = await prisma.seriesInfo.findUnique({
    where: { slug: slugify(name) },
  });
  const info = saved?.info as SeriesInfo | null | undefined;
  return info?.name ? info : null;
}

// null when we don't know the series at all. `mayAsk` false reads the
// database only (a crawler mustn't start lookups)
export async function getAfterAnime(asked: string, mayAsk: boolean) {
  const name = await knownSeriesName(asked);
  // a crawler sending made-up names mustn't turn into AniList lookups: for
  // it, only a series we've already seen
  const info = mayAsk ? await getSeriesInfo(name) : await savedSeriesInfo(name);
  if (!info) return null;
  const slug = slugify(info.name);
  // MangaUpdates would be asked about the manga, and a novel's volumes and
  // chapters aren't the manga's
  const novel = isNovelName(info.name);
  const [saved, fixes] = await Promise.all([
    novel ? null : animeLinesFor(info, mayAsk),
    acceptedFixes(slug),
  ]);
  // MangaUpdates names a first series after the manga ("Bleach", beside
  // "Thousand-Year Blood War part 1"). Beside later ones that's the original
  // series; on its own it's simply the anime
  const lines = readAnimeStops(saved?.startLine, saved?.endLine);
  const namedAfterManga = lines.length > 1 ? "Original series" : "The anime";
  const read = lines.map((stop) =>
    sameName(stop.label, info.name)
      ? { ...stop, label: namedAfterManga }
      : stop,
  );
  const stops = withFixes(read, fixes);
  const manga: MangaEnd = {
    finished: info.status === "FINISHED",
    volumes: info.volumes,
    lastChapter: saved?.lastChapter ?? null,
  };
  return {
    name: info.name,
    slug,
    coverUrl: info.coverUrl,
    stops: stops.map((stop): SentStop => ({
      ...stop,
      coversAll: reachesTheEnd(stop, stops, manga),
    })),
    // MangaUpdates' page for the series, for the credit; null when the
    // answer isn't theirs
    sourceUrl: saved?.endLine ? saved.sourceUrl : null,
    checkedAt: saved?.fetchedAt ?? null,
  };
}

// every series with an answer, for the list of shows and the sitemap: the
// most popular first. Database only
export async function getAfterAnimeIndex() {
  const fixed = await slugsWithFixes();
  const [rows, known] = await Promise.all([
    prisma.animeStops.findMany({
      where: { OR: [{ endLine: { not: null } }, { slug: { in: [...fixed] } }] },
      select: {
        slug: true,
        name: true,
        startLine: true,
        endLine: true,
        fetchedAt: true,
      },
    }),
    listKnownSeries(),
  ]);
  const infoBySlug = new Map(known.map((info) => [slugify(info.name), info]));
  const shows = [];
  for (const row of rows) {
    const info = infoBySlug.get(row.slug);
    const seasons = readAnimeStops(row.startLine, row.endLine).length;
    // a line nothing could be read from isn't an answer
    if (!info || (!seasons && !fixed.has(row.slug))) continue;
    shows.push({
      name: info.name,
      slug: row.slug,
      coverUrl: info.coverUrl,
      popularityRank: info.popularityRank,
      seasons,
      // when MangaUpdates was last asked, for the sitemap
      checkedAt: row.fetchedAt,
    });
  }
  const last = Number.MAX_SAFE_INTEGER;
  return shows.sort(
    (a, b) => (a.popularityRank ?? last) - (b.popularityRank ?? last),
  );
}
