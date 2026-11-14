// The New tab's arithmetic, with no network: how many series have
// news, how far behind a series is, the volumes a behind card lists, and
// whether something is still new after a change. lib/shelf.ts
// re-exports all of it, so callers can import from either. Pure, so the
// server's tests can load it.
import type { Manga, ReleaseStatus } from "./types";

// what a check came to: only "failed" means the sites didn't answer
export type ReleaseOutcome = "news" | "notFound" | "skipped" | "off" | "failed";

// how many are out past where they are (at least the one that put it on
// New): volumes, chapters, or volumes in Japan
export function behindOf(
  found: ReleaseStatus | null | undefined,
  kind: "volumes" | "chapters" | "japan",
) {
  if (!found) return 1;
  if (kind === "japan") return Math.max(1, found.outJapanVolumes.length);
  if (kind === "chapters")
    return found.latestChapter != null && found.nextChapter != null
      ? Math.max(1, Math.floor(found.latestChapter) - found.nextChapter + 1)
      : 1;
  return Math.max(1, found.outVolumes.length);
}

// Is it news: the one thing out is the newest, so they're caught up but
// for it. (The tab's "Next for you" pile.) Anything further back is a
// backlog: listed on the tab, not counted on its badge
const isNews = (found: ReleaseStatus | null | undefined) =>
  Boolean(
    (found?.hasNewVolume && behindOf(found, "volumes") === 1) ||
    (found?.hasNewChapter && behindOf(found, "chapters") === 1),
  );

// The number on New's red badge: the series with news, for any they've
// started. Not the length of the tab's list, which has the backlog too (a
// big shelf's badge read 71)
export const countNew = (
  manga: Manga[],
  releases: Record<number, ReleaseStatus | null>,
) => manga.filter((m) => !m.planned && isNews(releases[m.id])).length;

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

// the volumes that are out and aren't theirs, less any they've hidden: the
// list a card that's behind opens
export const remainingVolumes = (m: Manga, found: ReleaseStatus) =>
  found.outVolumes.filter(
    (v) =>
      v.volume > (m.seenVolume ?? 0) &&
      !(m.hiddenVolumes ?? []).includes(v.volume),
  );

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
