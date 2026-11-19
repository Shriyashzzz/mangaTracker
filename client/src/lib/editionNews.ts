// The New tab for someone collecting an edition. A release check answers in
// single volumes ("vol. 13 is out, you're 25 behind"); for a series
// collected as VIZBIG that's the wrong unit. The shelf's list says where
// they are in the edition's books (manga.editionPlace, from the server's
// util/shelf/editionPlace.ts), and this reads a series' volume news through
// it. Pure.
//
// Edition books have no release dates here, so nothing claims one "is out":
// a card only says which book is next for them and how many they lack.
import type { Manga, ReleaseStatus } from "./types";

type Place = NonNullable<Manga["editionPlace"]>;

// the place, when it says enough to count in books
const inBooks = (m: Pick<Manga, "editionPlace">): Place | null =>
  m.editionPlace && m.editionPlace.behind != null ? m.editionPlace : null;

// A series' release answer as its reader should hear it. Someone who has
// every book of their edition has no volume news: a single volume coming
// out isn't a book of theirs. Someone with books still to get has them
// counted and named as books. (Chapters and Japan are left as they are)
export function forEdition(
  m: Pick<Manga, "editionPlace">,
  found: ReleaseStatus | null,
): ReleaseStatus | null {
  const place = inBooks(m);
  if (!found || !place) return found;
  if (place.next == null)
    return { ...found, hasNewVolume: false, volumeListed: false };
  // a book still to get: the tab counts and names in books (releaseMath.ts
  // behindOf and nextVolumeName read this)
  return {
    ...found,
    editionBooks: {
      label: place.label,
      next: place.next,
      behind: place.behind ?? 1,
    },
  };
}

// every series' answer, read that way: what the New tab and its count use
export function editionReleases(
  manga: Manga[],
  releases: Record<number, ReleaseStatus | null>,
) {
  const collected = manga.filter((m) => inBooks(m) && m.id in releases);
  if (!collected.length) return releases;
  const read = { ...releases };
  for (const m of collected) read[m.id] = forEdition(m, releases[m.id]!);
  return read;
}

// What a New card says for a series collected as an edition, in its books;
// null for single volumes, and when no book is next
export function editionNews(m: Pick<Manga, "editionPlace">) {
  const place = inBooks(m);
  if (!place || place.next == null) return null;
  const behind = place.behind ?? 0;
  return {
    text: `${place.label} ${place.next} next`,
    // one behind is just the next one: that's news, never "behind"
    behind: behind > 1 ? `${behind} books behind` : undefined,
    yours: place.upTo
      ? `You have up to ${place.label} ${place.upTo}`
      : undefined,
    // how many books behind, for the pile it's put in
    count: behind,
  };
}
