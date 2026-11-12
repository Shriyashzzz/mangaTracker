// The account's own details, and shared lists.
import { apiFetch, errorMessages, getJson } from "./api";
import { SORT_OPTIONS } from "./shelf";

export type Account = {
  username: string;
  displayName: string | null;
  avatar: string | null;
  recoveryEmail: string | null;
  shareEnabled: boolean;
  shareNotes: boolean;
  shareCode: string | null;
  // what they show as until they pick a name, and ideas for one
  defaultName: string;
  nameIdeas: string[];
};

export type SharedShelf = {
  displayName: string;
  avatar: string | null;
  manga: {
    name: string;
    image: string | null;
    genre: string | null;
    status: boolean;
    // on their To read list
    planned?: boolean;
    lightNovel?: boolean;
    bookmark: number | null;
    // only what they track is sent: the chapter, the volume read, or both
    readVolume?: number | null;
    rating: number | null;
    notes?: string;
    // the volumes they own, as on their shelf (lib/ownedVolumes.ts)
    volumesOwned?: number | null;
    ownedList?: number[];
  }[];
};

export const getAccount = (signal?: AbortSignal) =>
  getJson<Account>("/api/account", signal);

// throws with what was wrong, in words for the page
export async function saveAccount(
  patch: Partial<
    Omit<Account, "username" | "shareCode" | "defaultName" | "nameIdeas">
  >,
) {
  const res = await apiFetch("/api/account", { method: "PATCH", body: patch });
  if (!res.ok)
    throw new Error((await errorMessages(res))[0] ?? "That didn't save.");
  return (await res.json()) as Account;
}

export async function deleteAccount(password: string) {
  const res = await apiFetch("/api/account", {
    method: "DELETE",
    body: { password },
  });
  if (!res.ok)
    throw new Error((await errorMessages(res))[0] ?? "That didn't work.");
}

export const getSharedShelf = (code: string, signal?: AbortSignal) =>
  getJson<SharedShelf>(`/api/share/${encodeURIComponent(code)}`, signal);

export const shareUrl = (code: string) => `${window.location.origin}/u/${code}`;

// the shelf as a backup file: lib/shelfCsv.ts (no network code there, so it
// can be tested)
export { shelfToCsv } from "./shelfCsv";

export const SHELF_TABS = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "new", label: "New" },
] as const;

export { SORT_OPTIONS };
