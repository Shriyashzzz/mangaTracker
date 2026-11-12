// Small shelf calls used outside the shelf pages (the volume page's
// "On my shelf" button).
import { apiFetch, getJson } from "./api";
import type { ReleaseData, ReleaseStatus, ShelfMatch } from "./types";
import type { ReleaseOutcome, SeenKind } from "./releaseMath";

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

// the shelf's saved answers the server still stands by, all at once: the New
// tab opens with these and asks one at a time only about the rest
export const getSavedReleases = (signal?: AbortSignal) =>
  getJson<{
    answers: Record<
      string,
      {
        releaseStatus: ReleaseStatus | null;
        complete: boolean;
        outcome: ReleaseOutcome;
        checkedAt: string;
      }
    >;
    // their release settings, as a fingerprint: changed on another device,
    // what this browser kept no longer holds
    settings?: string;
  }>("/api/manga/releases/saved", signal);

// the server gives up on a slow title before this; if even it stops answering,
// the shelf moves on to the next title rather than waiting forever
export const RELEASE_CHECK_TIMEOUT_MS = 50_000;

export const SORT_OPTIONS = [
  { value: "", label: "Last bookmarked" },
  { value: "rating-dsc", label: "Highest rated" },
  { value: "ch-dsc", label: "Most chapters read" },
  // a collector's biggest runs first
  { value: "vol-dsc", label: "Most volumes owned" },
  // runs with holes in them first, the most missing on top
  { value: "gaps-dsc", label: "Most gaps first" },
  { value: "added-dsc", label: "Recently added" },
  { value: "name-asc", label: "Title, A to Z" },
] as const;
// a sort the shelf knows (and the only ones the server saves, PREF_VALUES)
export type ShelfSort = (typeof SORT_OPTIONS)[number]["value"];

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
