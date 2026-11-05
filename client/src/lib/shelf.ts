// Small shelf calls used outside the shelf pages (the volume page's
// "On my shelf" button).
import { apiFetch, getJson } from "./api";
import type { Manga, ReleaseData, ReleaseStatus, ShelfMatch } from "./types";

// release dates and what's new in English for one manga on the shelf
// the shelf says which lane it waits in (lib/releaseOrder.ts); the details
// page leaves it out, so it's asked in "now" and never skipped
export const getReleases = (
  id: number,
  signal?: AbortSignal,
  lane?: "now" | "later",
) =>
  getJson<{
    releaseData: ReleaseData | null;
    releaseStatus: ReleaseStatus | null;
    // false if a source didn't answer, so it's worth asking again
    complete: boolean;
    // what it came to (left out by a server from before outcomes)
    outcome?: ReleaseOutcome;
  }>(`/api/manga/${id}/releases${lane ? `?lane=${lane}` : ""}`, signal);

// what a check came to: only "failed" means the sites didn't answer
export type ReleaseOutcome = "news" | "notFound" | "skipped" | "off" | "failed";

// the server gives up on a slow title before this; if even it stops answering,
// the shelf moves on to the next title rather than waiting forever
export const RELEASE_CHECK_TIMEOUT_MS = 50_000;

export const SORT_OPTIONS = [
  { value: "", label: "Last bookmarked" },
  { value: "rating-dsc", label: "Highest rated" },
  { value: "ch-dsc", label: "Most chapters read" },
  { value: "name-asc", label: "Title, A to Z" },
];

export type SeenKind = "volume" | "chapter" | "japan";

export async function saveSeen(
  id: number,
  kind: SeenKind,
  number: number | null,
  hiddenVolumes?: number[],
) {
  const res = await apiFetch(`/api/manga/${id}/seen`, {
    method: "PATCH",
    body: { kind, number, ...(hiddenVolumes ? { hiddenVolumes } : {}) },
  });
  if (!res.ok) throw new Error("Couldn't save that");
}

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

// set once a whole shelf has had its releases checked
export const CHECKED_BEFORE_KEY = "releasesCheckedBefore";
// how many were new at the last full check, for the New tab before it's opened
export const LAST_NEW_COUNT_KEY = "releasesLastNewCount";

// makes the shelf open on its New tab; call just before going to /shelf
export const openReleasesOnShelf = () => {
  try {
    sessionStorage.setItem("libraryStatus", "new");
  } catch {
    // storage can be blocked; the shelf just opens on its usual tab
  }
};

// the manga on the signed-in shelf that is this series, or null
export const findOnShelf = (series: string, signal?: AbortSignal) =>
  getJson<ShelfMatch>(
    `/api/manga/match?${new URLSearchParams({ series })}`,
    signal,
  );

export type Owned = { volumesOwned: number | null; ownedList: number[] };

// sets what they own: "up to" a volume (null clears it) or the exact list
// (lib/ownedVolumes.ts); returns what was saved
export async function setVolumesOwned(id: number, owned: Owned) {
  const res = await apiFetch(`/api/manga/${id}/owned`, {
    method: "PUT",
    body: owned,
  });
  if (!res.ok) throw new Error("Couldn't update the shelf");
  return (await res.json()) as Owned;
}
