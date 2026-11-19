// Friends: the shared shelves a reader follows (server friends/friends.ts).
// Sharing a shelf is its owner's yes; one whose sharing goes off isn't listed
import { apiFetch, getJson } from "./api";
import { orOffline } from "./offline";

export type Friend = {
  code: string;
  name: string;
  avatar: string | null;
  series: number;
  volumes: number;
};

export const getFriends = () =>
  getJson<{ friends: Friend[] }>("/api/friends").then((r) => r.friends);

// follow a shared shelf, or stop; what's saved
export async function setFollowing(code: string, on: boolean) {
  const res = await apiFetch(`/api/share/${encodeURIComponent(code)}/follow`, {
    method: on ? "POST" : "DELETE",
  });
  if (!res.ok) throw new Error(orOffline("That didn't save. Try again."));
  return ((await res.json()) as { following: boolean }).following;
}
