// Small shelf calls used outside the shelf pages (the volume page's
// "On my shelf" button).
import { apiFetch, getJson } from "./api";
import type { ReleaseData, ReleaseStatus, ShelfMatch } from "./types";

// release dates and what's new in English for one manga on the shelf
export const getReleases = (id: number, signal?: AbortSignal) =>
  getJson<{
    releaseData: ReleaseData | null;
    releaseStatus: ReleaseStatus | null;
    // false if a source didn't answer, so it's worth asking again
    complete: boolean;
  }>(`/api/manga/${id}/releases`, signal);

// the server gives up on a slow title before this; if even it stops answering,
// the shelf moves on to the next title rather than waiting forever
export const RELEASE_CHECK_TIMEOUT_MS = 50_000;

// set once a whole shelf has had its releases checked
export const CHECKED_BEFORE_KEY = "releasesCheckedBefore";

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

// sets how many volumes they own (null clears it); returns the saved value
export async function setVolumesOwned(id: number, volumesOwned: number | null) {
  const res = await apiFetch(`/api/manga/${id}/owned`, {
    method: "PUT",
    body: { volumesOwned },
  });
  if (!res.ok) throw new Error("Couldn't update the shelf");
  return ((await res.json()) as { volumesOwned: number | null }).volumesOwned;
}
