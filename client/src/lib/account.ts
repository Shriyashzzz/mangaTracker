// The account's own details, and shared lists.
import { apiFetch, errorMessages, getJson } from "./api";
import { SORT_OPTIONS } from "./shelf";
import { orOffline } from "./offline";

export type Account = {
  username: string;
  displayName: string | null;
  avatar: string | null;
  recoveryEmail: string | null;
  shareEnabled: boolean;
  shareNotes: boolean;
  // on their shared shelf: their star ratings, and how far they've read
  shareRatings: boolean;
  shareProgress: boolean;
  shareCode: string | null;
  // the weekly email: switched on, and whether the address was confirmed
  // from the link mailed to it (nothing weekly is sent until it is)
  weeklyEmail: boolean;
  emailConfirmed: boolean;
  // the confirm link was meant to go just now and didn't: said on the page
  // instead of "press the link we sent". Only on that one answer
  confirmNotSent?: boolean;
  // how they sign in: with Google too, and whether they have a password
  // (an account made with Google has none until they set one)
  google: boolean;
  hasPassword: boolean;
  // what they show as until they pick a name, and ideas for one
  defaultName: string;
  nameIdeas: string[];
};

export type SharedShelf = {
  // the viewer is its owner
  yours?: boolean;
  // the viewer follows it (Friends)
  following?: boolean;
  // the series its owner put at the top, by name, in their order
  top?: string[];
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
    // the volume right after their highest, with its price page: for the
    // "To get" tab. `comingOut`: its release date, when it isn't out yet
    next?: {
      volume: number;
      isbn13: string;
      title: string;
      comingOut: string | null;
      // the best new price on file for it, in cents
      fromCents?: number | null;
    };
    // they have every volume that's out
    ownsAll?: boolean;
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
    Omit<
      Account,
      | "username"
      | "shareCode"
      | "defaultName"
      | "nameIdeas"
      | "weeklyEmail"
      | "emailConfirmed"
      | "confirmNotSent"
    >
  >,
) {
  const res = await apiFetch("/api/account", { method: "PATCH", body: patch });
  if (!res.ok)
    throw new Error(
      (await errorMessages(res))[0] ?? orOffline("That didn't save."),
    );
  return (await res.json()) as Account;
}

// Switches the weekly email on or off. On mails a confirm link until the
// address has been confirmed, so "on" again is also "send it again".
// Throws with what was wrong, in words for the page
export async function setWeeklyEmail(on: boolean) {
  const res = await apiFetch("/api/account/weekly-email", {
    method: "POST",
    body: { on },
  });
  if (!res.ok)
    throw new Error(
      (await errorMessages(res))[0] ?? orOffline("That didn't save."),
    );
  return (await res.json()) as Account;
}

// signs in with Google too: the token from Google's button
export async function linkGoogle(credential: string) {
  const res = await apiFetch("/api/account/google", {
    method: "POST",
    body: { credential },
  });
  if (!res.ok)
    throw new Error(
      (await errorMessages(res))[0] ?? orOffline("That didn't work."),
    );
  return (await res.json()) as Account;
}

// an account made with Google sets its first password
export async function setFirstPassword(password: string) {
  const res = await apiFetch("/api/account/password", {
    method: "POST",
    body: { password },
  });
  if (!res.ok)
    throw new Error(
      (await errorMessages(res))[0] ?? orOffline("That didn't save."),
    );
  return (await res.json()) as Account;
}

// proven with their password, or with no password (made with Google) their
// username
export async function deleteAccount(proof: {
  password?: string;
  username?: string;
}) {
  const res = await apiFetch("/api/account", {
    method: "DELETE",
    body: proof,
  });
  if (!res.ok)
    throw new Error(
      (await errorMessages(res))[0] ?? orOffline("That didn't work."),
    );
}

export const getSharedShelf = (code: string, signal?: AbortSignal) =>
  getJson<SharedShelf>(`/api/share/${encodeURIComponent(code)}`, signal);

// the owner's picks for the top of their shared shelf (up to five names);
// false when it didn't save
export async function saveShareTop(names: string[]) {
  const res = await apiFetch("/api/prefs", {
    method: "PUT",
    body: { shareTop: names },
  }).catch(() => null);
  return Boolean(res?.ok);
}

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
