// The account's own details, and shared lists.
import { apiFetch, errorMessages, getJson } from "./api";
import { SORT_OPTIONS } from "./shelf";
import type { Manga } from "./types";

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
    rating: number | null;
    notes?: string;
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

// a spreadsheet treats a cell starting with these as a formula
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const shelfToCsv = (manga: Manga[]) =>
  [
    [
      "Title",
      "Type",
      "Status",
      "Chapter",
      "Volumes owned",
      "Rating",
      "Genre",
      "Notes",
    ],
    ...manga.map((m) => [
      m.name,
      m.lightNovel ? "Light novel" : "Manga",
      m.status ? "Finished" : m.planned ? "To read" : "Reading",
      m.bookmark,
      m.volumesOwned,
      m.rating,
      m.genre,
      m.description,
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

export const SHELF_TABS = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Reading" },
  { value: "finished", label: "Finished" },
  { value: "new", label: "New" },
] as const;

export { SORT_OPTIONS };
