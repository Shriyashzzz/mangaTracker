import { apiFetch } from "./api";

// the manga on the signed-in shelf that is this series, or null
export async function findOnShelf(series, signal) {
  const res = await apiFetch(
    `/api/mangadata/match?${new URLSearchParams({ series })}`,
    { signal },
  );
  if (!res.ok) throw new Error("Couldn't check the shelf");
  return res.json();
}

// sets how many volumes they own (null clears it); returns the saved value
export async function setVolumesOwned(id, volumesOwned) {
  const res = await apiFetch(`/api/mangadata/${id}/owned`, {
    method: "PUT",
    body: { volumesOwned },
  });
  if (!res.ok) throw new Error("Couldn't update the shelf");
  return (await res.json()).volumesOwned;
}
