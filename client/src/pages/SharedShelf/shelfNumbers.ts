// A shared shelf in a few numbers, for the line under its owner's name: how
// many series they have every volume of, their longest run, what they read
// most, and how the shelf splits by genre. Pure: no network, no components.
import { ownedCountOf, type SharedManga } from "./shareParts";

// a run shorter than this isn't worth pointing at
const LONG_RUN = 5;
// "mostly action" only when it's at least this share of the shelf
const MOSTLY = 0.3;
// the genre bar names this many, and gathers the rest as "Other"
const NAMED_GENRES = 4;
// too few series with a genre and the bar says nothing
const ENOUGH_FOR_GENRES = 6;

// "unlabled" is what a series with no genre is saved as
export const genreOf = (m: SharedManga) =>
  m.genre && m.genre !== "unlabled" ? m.genre : null;

// every genre on the shelf, the most common first: what the filter offers
export function genresOn(manga: SharedManga[]) {
  const counts = new Map<string, number>();
  for (const m of manga) {
    const genre = genreOf(m);
    if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export type GenreShare = { name: string; count: number };

export function shelfNumbers(manga: SharedManga[]) {
  const ownsAll = manga.filter((m) => m.ownsAll).length;

  const [longest] = [...manga].sort(
    (a, b) => ownedCountOf(b) - ownedCountOf(a),
  );
  const longestRun =
    longest && ownedCountOf(longest) >= LONG_RUN
      ? { name: longest.name, volumes: ownedCountOf(longest) }
      : null;

  const counts = new Map<string, number>();
  for (const m of manga) {
    const genre = genreOf(m);
    if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  const byCount = [...counts]
    .map(([name, count]): GenreShare => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const withGenre = byCount.reduce((n, g) => n + g.count, 0);
  const top = byCount[0];
  const mostly = top && top.count / withGenre >= MOSTLY ? top.name : null;

  // the biggest few by name, the rest as one
  const named = byCount.slice(0, NAMED_GENRES);
  const others = withGenre - named.reduce((n, g) => n + g.count, 0);
  const genres: GenreShare[] =
    withGenre >= ENOUGH_FOR_GENRES && byCount.length > 1
      ? [...named, ...(others ? [{ name: "Other", count: others }] : [])]
      : [];

  return { ownsAll, longestRun, mostly, genres };
}

// their five-star series, for the row of favourites
export const favouritesOf = (manga: SharedManga[]) =>
  manga.filter((m) => m.rating === 5);

// the series with a next volume to get: ones they've started, not their
// To read list
export const toGetOf = (manga: SharedManga[]) =>
  manga.filter((m) => m.next && !m.planned);
