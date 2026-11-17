// The series the site already knows (series_info, saved as series are looked
// up), read from the database at most once an hour and kept in memory: no
// new storage, no API calls. Two uses:
//   - a typo AniList can't answer: AniList matches whole words, so "chainsw
//     man" finds nothing there, but it's one slip from Chainsaw Man here
//   - the price search while AniList has asked us to wait: the series we
//     know, matched here, so a search never comes back empty-handed for
//     one the site has seen (sources/anilist.ts searchSeries)
import { prisma } from "../config/prisma.js";
import { closeEnough, slipsInName } from "../util/shelf/spelling.js";
import { slugify } from "./stores/match.js";
import { isNovelName } from "./lightNovel.js";
import type { SeriesHit } from "./types.js";
import { withShownScore } from "./scores.js";

const REFRESH_MS = 60 * 60_000;
// names offered for one typo, closest first
const MOST = 3;
// series offered for a search answered from here
const MOST_HITS = 12;

// what a search result needs of each, and its other names to match on
type Known = {
  anilistId: number | null;
  name: string;
  altNames: string[];
  coverUrl: string | null;
  score: number | null;
  volumes: number | null;
  status: string | null;
  popularityRank: number | null;
};

let known: Known[] = [];
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function load() {
  const rows = await prisma.$queryRaw<
    (Omit<Known, "altNames"> & { altNames: string[] | null })[]
  >`
    SELECT DISTINCT ON (info->>'name')
      (info->>'anilistId')::int AS "anilistId",
      info->>'name' AS name,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(info->'altNames', '[]'))) AS "altNames",
      info->>'coverUrl' AS "coverUrl",
      (info->>'score')::int AS score,
      (info->>'volumes')::int AS volumes,
      info->>'status' AS status,
      (info->>'popularityRank')::int AS "popularityRank"
    FROM series_info
    WHERE info->>'name' IS NOT NULL
    ORDER BY info->>'name', fetched_at DESC`;
  known = rows.map((row) => ({ ...row, altNames: row.altNames ?? [] }));
  loadedAt = Date.now();
}

// the list, read again when it's an hour old (one read at a time)
async function knownSeries() {
  if (Date.now() - loadedAt >= REFRESH_MS) {
    loading ??= load().finally(() => (loading = null));
    await loading;
  }
  return known;
}

// the known names a typo is near, closest first: every word typed is a
// word of the name, give or take a slip of the finger
export async function nearSeriesNames(typed: string) {
  return (await knownSeries())
    .map((series) => series.name)
    .filter((name) => closeEnough(typed, name))
    .map((name) => ({ name, slips: slipsInName(typed, name) }))
    .sort((a, b) => a.slips - b.slips || a.name.length - b.name.length)
    .slice(0, MOST)
    .map((near) => near.name);
}

// the known series a search finds, the most popular first: a name (or one of
// its other names) holding what was typed, or a slip of the finger from it
export async function knownSeriesHits(typed: string): Promise<SeriesHit[]> {
  const asked = typed.trim().toLowerCase();
  if (asked.length < 2) return [];
  const matches = (name: string) =>
    name.toLowerCase().includes(asked) ||
    (asked.length >= 4 && closeEnough(asked, name));
  const found = (await knownSeries())
    .filter((s) => [s.name, ...s.altNames].some(matches))
    .sort(
      (a, b) =>
        (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MOST_HITS);
  // with the score each one shows (scores.ts)
  return (await withShownScore(found)).map((s) => ({
    name: s.name,
    slug: slugify(s.name),
    score: s.score,
    volumes: s.volumes,
    status: s.status,
    coverUrl: s.coverUrl,
    ...(isNovelName(s.name) ? { lightNovel: true } : {}),
  }));
}

// for tests: the list as it is now, read again on the next ask
export const forgetSeriesNames = () => {
  loadedAt = 0;
};
