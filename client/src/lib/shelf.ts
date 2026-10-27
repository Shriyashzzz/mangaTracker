// Small shelf calls used outside the shelf pages (the volume page's
// "On my shelf" button).
import { apiFetch, getJson } from "./api";
import type { ShelfMatch } from "./types";

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
