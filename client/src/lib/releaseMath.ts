// The New tab's arithmetic, with no network: how many series have something
// new, what a grouped entry still has to show once what's hidden is taken
// away, and whether something is still new after a change. lib/shelf.ts
// re-exports all of it, so callers can import from either. Pure, so the
// server's tests can load it.
import type { Manga, ReleaseStatus } from "./types";

// what a check came to: only "failed" means the sites didn't answer
export type ReleaseOutcome = "news" | "notFound" | "skipped" | "off" | "failed";

// how many series have something new: a new volume or chapter past where
// they are, for any they've started
export const countNew = (
  manga: Manga[],
  releases: Record<number, ReleaseStatus | null>,
) =>
  manga.filter(
    (m) =>
      !m.planned &&
      (releases[m.id]?.hasNewVolume || releases[m.id]?.hasNewChapter),
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

// what a grouped entry still has to show, once what's hidden is taken away
export const remainingVolumes = (m: Manga, found: ReleaseStatus) =>
  found.outVolumes.filter(
    (v) =>
      v.volume > (m.seenVolume ?? 0) &&
      !(m.hiddenVolumes ?? []).includes(v.volume),
  );
export const remainingJapanVolumes = (m: Manga, found: ReleaseStatus) =>
  found.outJapanVolumes.filter((v) => v > (m.seenJapanVolume ?? 0));
// from the first one they haven't hidden up to the latest. We only know the
// latest number, so a number in between may not be a real chapter
export const remainingChapters = (m: Manga, found: ReleaseStatus) => {
  const { nextChapter, latestChapter } = found;
  if (nextChapter == null || latestChapter == null) return [];
  const seen = m.seenChapter ?? 0;
  const first = seen >= nextChapter ? Math.floor(seen) + 1 : nextChapter;
  const chapters: number[] = [];
  for (let n = first; n <= latestChapter; n++) chapters.push(n);
  if (latestChapter > seen && chapters.at(-1) !== latestChapter) {
    chapters.push(latestChapter);
  }
  return chapters;
};

// whether it's still new, after a change to what they've hidden
export const isStillNew = (kind: SeenKind, m: Manga, found: ReleaseStatus) => {
  if (kind === "volume") {
    if (found.volumeMode === "all")
      return remainingVolumes(m, found).length > 0;
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
      found.chapterListed &&
      (found.chapterMode === "all"
        ? (found.latestChapter ?? 0)
        : (found.nextChapter ?? 0)) > (m.seenChapter ?? 0)
    );
  }
  return (
    found.japanListed &&
    (found.latestJapaneseVolume ?? 0) > (m.seenJapanVolume ?? 0)
  );
};
