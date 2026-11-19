// The New tab for someone collecting an edition. A release check answers in
// single volumes ("vol. 13 is out, you're 25 behind"); for a series
// collected as VIZBIG that's the wrong unit. The shelf's list says where
// they are in the edition's books (manga.editionPlace, from the server's
// util/shelf/editionPlace.ts), and this reads a series' volume news through
// it. Pure.
//
// A book's release day comes from the catalogs (Google Books has most of
// them, to the day). Nothing is said about a day the catalogs don't give in
// full: a year alone isn't news.
import { realBooksOf } from "./editionShelf";
import type { EditionBook, EditionLine } from "./editions";
import type { Manga, ReleaseStatus } from "./types";

// a day given in full, "2026-03-04": the only kind that's ever said
const FULL_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const fullDayOf = (published?: string | null) =>
  published && FULL_DAY.test(published) ? published : null;
// today as the reader's own calendar has it, "2026-11-19"
export function todayOf(now = new Date()) {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

// The news the series' page has for someone collecting an edition: their
// next book is just out, or has a day it comes out. As for single volumes
// (pages/Details/releaseNews.ts), it's news only for someone caught up:
//   - they have a book of the edition, and every book before their furthest
//   - the next one is out and is the newest out ("VIZBIG 13 is out!"), or
//     isn't out yet and has a day ("VIZBIG 13 comes out Mar 4")
// A book is "had" when they own all of it or have read all of it. Null when
// there's no such news, and whenever the day isn't known in full
export function editionRelease(
  line: EditionLine,
  owned: number[],
  readVolume: number | null,
  today: string,
): { book: EditionBook; isOut: boolean; day: string } | null {
  const books = realBooksOf(line);
  const mine = new Set(owned);
  const had = (book: EditionBook) =>
    book.volumes.every((v) => mine.has(v)) ||
    Math.max(...book.volumes) <= (readVolume ?? 0);
  const furthest = books.map(had).lastIndexOf(true);
  if (furthest < 0) return null;
  // a gap behind their furthest is being behind, not news
  if (!books.slice(0, furthest).every(had)) return null;
  const next = books[furthest + 1];
  const day = fullDayOf(next?.published);
  if (!next || !day) return null;
  if (day > today) return { book: next, isOut: false, day };
  // out: news only when it's the newest out. With another after it that
  // isn't known to be still coming, they're further behind than one book
  const after = books[furthest + 2];
  const afterDay = fullDayOf(after?.published);
  const afterIsComing = afterDay != null && afterDay > today;
  if (after && !afterIsComing) return null;
  return { book: next, isOut: true, day };
}

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
  // nothing next for them, or their next book isn't out yet: no news
  const nextDay = fullDayOf(place.nextPublished);
  const notOutYet = nextDay != null && nextDay > todayOf();
  if (place.next == null || notOutYet)
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
