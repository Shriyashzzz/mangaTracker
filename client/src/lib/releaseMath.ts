// The New tab's arithmetic, with no network: how many series have
// news, how far behind a series is, and
// whether something is still new after a change. lib/shelf.ts
// re-exports all of it, so callers can import from either. Pure, so the
// server's tests can load it.
import type { Manga, ReleaseStatus } from "./types";

// what a check came to: only "failed" means the sites didn't answer
export type ReleaseOutcome = "news" | "notFound" | "skipped" | "off" | "failed";

// How many they don't have (at least the one that put it on New): volumes,
// chapters, or volumes in Japan. For volumes it's the newest one's number
// less theirs, not how many books we have: the catalog has holes (Hunter x
// Hunter with seven volumes missing said "25 behind" for 32). Plus the gaps
// behind their furthest (Chainsaw Man owning 1–11 and 13–17 of 22: 6)
export function behindOf(
  found: ReleaseStatus | null | undefined,
  kind: "volumes" | "chapters" | "japan",
) {
  // (an edition's count has its gaps in it already)
  const countsGaps = kind === "volumes" && !found?.editionBooks;
  const gaps = countsGaps ? (found?.gapVolumes?.length ?? 0) : 0;
  return behindPastTheirs(found, kind) + gaps;
}

// how many are out past the furthest they have, gaps behind it aside
function behindPastTheirs(
  found: ReleaseStatus | null | undefined,
  kind: "volumes" | "chapters" | "japan",
) {
  if (!found) return 1;
  // collected as an edition: the books of it they don't have
  if (kind === "volumes" && found.editionBooks)
    return Math.max(1, found.editionBooks.behind);
  if (kind === "japan") return Math.max(1, found.outJapanVolumes.length);
  if (kind === "chapters")
    return found.latestChapter != null && found.nextChapter != null
      ? Math.max(1, Math.floor(found.latestChapter) - found.nextChapter + 1)
      : 1;
  const { latestVolume, currentVolume } = found;
  if (latestVolume != null && currentVolume != null)
    return Math.max(1, Math.floor(latestVolume) - Math.floor(currentVolume));
  return Math.max(1, found.outVolumes.length);
}

// Do we know which volume is next for them? Yes when the catalog's next
// book is the one right after theirs, or is the newest volume (a new
// release). No when the catalog has a hole there: Hunter x Hunter's books
// start again at vol. 10, and "Vol. 10 next" to someone who owns vol. 1 is
// wrong. Then a card only says how far behind they are
export function knowsNextVolume(found: ReleaseStatus | null | undefined) {
  if (!found || found.nextVolume == null) return false;
  if (found.nextIsGap) return true;
  if (found.currentVolume == null) return true;
  return (
    found.nextVolume === Math.floor(found.currentVolume) + 1 ||
    found.nextVolume === found.latestVolume
  );
}

// Every volume past theirs up to the newest, each with its book when the
// catalog has one: the list a card that's behind opens. A number with no
// book still gets a row, so the list is as long as the card says
export function volumesToGet(found: ReleaseStatus) {
  const { latestVolume, currentVolume, outVolumes } = found;
  // the gaps behind their furthest first, then what's out past it
  const gaps = found.gapVolumes ?? [];
  if (latestVolume == null || currentVolume == null)
    return [...gaps, ...outVolumes];
  const books = new Map(outVolumes.map((v) => [v.volume, v]));
  const list: ReleaseStatus["outVolumes"] = [...gaps];
  for (let n = Math.floor(currentVolume) + 1; n <= latestVolume; n++)
    list.push(books.get(n) ?? { volume: n });
  return list;
}

// The number New shows, on its badge and beside its heading: the series the
// tab lists, for any they've started. What the tab lists is their own
// choice (Settings, New releases: every series, or only the ones they're
// nearly caught up on), and the flags here already follow it, so the badge
// and the page always say the same number. A volume or a chapter counts;
// Japan's volumes have their own count on the tab
export const countNew = (
  manga: Manga[],
  releases: Record<number, ReleaseStatus | null>,
) =>
  manga.filter(
    (m) =>
      !m.planned &&
      Boolean(releases[m.id]?.hasNewVolume || releases[m.id]?.hasNewChapter),
  ).length;

// the count New shows, wherever it shows (the shelf's tab, the phones' bar):
// this visit's once every series is checked, until then what the last full
// check found, and nothing at all when every check failed
export function shownNewCount(
  manga: Manga[],
  releases: Record<number, ReleaseStatus | null>,
  outcomes: Record<number, ReleaseOutcome>,
  lastNewCount: number | null,
): number | null {
  const checked = manga.filter((m) => m.id in releases).length;
  const allChecked = checked > 0 && checked >= manga.length;
  if (allChecked && manga.every((m) => outcomes[m.id] === "failed"))
    return null;
  const live = countNew(manga, releases);
  return allChecked ? live : (lastNewCount ?? (checked ? live : null));
}

export type SeenKind = "volume" | "chapter" | "japan";

// whether it's still new, after a change to what they've hidden
export const isStillNew = (kind: SeenKind, m: Manga, found: ReleaseStatus) => {
  if (kind === "volume") {
    const next = found.nextVolume;
    return (
      found.volumeListed &&
      next != null &&
      next > (m.seenVolume ?? 0) &&
      !(m.hiddenVolumes ?? []).includes(next)
    );
  }
  if (kind === "chapter") {
    return (
      found.chapterListed && (found.nextChapter ?? 0) > (m.seenChapter ?? 0)
    );
  }
  return (
    found.japanListed &&
    (found.latestJapaneseVolume ?? 0) > (m.seenJapanVolume ?? 0)
  );
};

// the number of their next volume: the catalog's next book when it's the
// one right after theirs. With a hole there (JoJo Part 3's catalog has no
// vol. 11, Hunter x Hunter's starts again at vol. 10), the one after theirs
// all the same once a later one is out: volumes come out in order. Null
// when nothing past theirs is known to be out
export function nextVolumeNumber(found: ReleaseStatus | null | undefined) {
  if (knowsNextVolume(found)) return found!.nextVolume;
  const { currentVolume, latestVolume } = found ?? {};
  if (currentVolume == null || latestVolume == null) return null;
  const after = Math.floor(currentVolume) + 1;
  return latestVolume >= after ? after : null;
}

// what to call their next volume: "Vol. 15", or the book it's sold in,
// "Book 8", when it isn't sold on its own
export function nextVolumeName(found: ReleaseStatus | null | undefined) {
  // collected as an edition: its next book, "VIZBIG 5"
  if (found?.editionBooks)
    return `${found.editionBooks.label} ${found.editionBooks.next}`;
  const inBook = knowsNextVolume(found) ? found?.nextVolumeInBook : null;
  if (inBook) return `Book ${inBook.book}`;
  return `Vol. ${nextVolumeNumber(found) ?? found?.latestVolume ?? ""}`;
}

// "Next for you" as a reader who fills their gaps first sees it (Settings,
// Your shelf): their first gap, with its book when the catalog lists one
// (Detective Conan owning 1–59 and 70–92: vol. 60, not 93). Only for what a
// card shows and where it links: the piles, the counts and Hide still go by
// the volume after their furthest
export function withGapFirst(
  found: ReleaseStatus | null | undefined,
  nextFor: "after" | "gap",
): ReleaseStatus | null | undefined {
  const gap = found?.gapVolumes?.[0];
  if (nextFor !== "gap" || !found || !gap) return found;
  return {
    ...found,
    nextVolume: gap.volume,
    nextVolumeBook: gap.isbn13
      ? { isbn13: gap.isbn13, title: gap.title ?? "" }
      : null,
    nextVolumeInBook: null,
    nextVolumeChapters: null,
    nextIsGap: true,
  };
}
