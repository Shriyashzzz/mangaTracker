// "Where does the anime leave off?": what the server sends for a series
// (server: prices/afterAnime/) and where its pages live. The words for a
// season are in afterAnimeText.ts.
import { apiFetch, errorMessages, getJson } from "./api";
import type { AnimeStop } from "./afterAnimeText";
import { slugify } from "./prices";

export type AfterAnime = {
  name: string;
  slug: string;
  coverUrl: string | null;
  stops: AnimeStop[];
  // the series on MangaUpdates, for the credit; null when the answer isn't theirs
  sourceUrl: string | null;
  checkedAt: string | null;
};

// a series in the list of every show with an answer
export type AfterAnimeShow = {
  name: string;
  slug: string;
  coverUrl: string | null;
  popularityRank: number | null;
  seasons: number;
};

export const getAfterAnime = (name: string, signal?: AbortSignal) =>
  getJson<AfterAnime>(
    `/api/after-anime?${new URLSearchParams({ name })}`,
    signal,
  );

export const getAfterAnimeIndex = (signal?: AbortSignal) =>
  getJson<AfterAnimeShow[]>("/api/after-anime/index", signal);

export type FixToSend = {
  name: string;
  label: string;
  chapter: number | null;
  volume: number | null;
  source: string;
  note: string;
};

// sends a correction; gives back what went wrong, or "" when it was kept
export async function sendFix(fix: FixToSend) {
  const res = await apiFetch("/api/after-anime/fix", {
    method: "POST",
    body: fix,
  });
  if (res.ok) return "";
  return (await errorMessages(res))[0] ?? "That didn't send. Try again.";
}

export const AFTER_ANIME_PATH = "/after-the-anime";
// a series' page, from a search: the link carries the real name, as a price
// page's does, so a series we haven't seen yet can still be found
export const afterAnimePath = (name: string) =>
  `${AFTER_ANIME_PATH}/${slugify(name)}?${new URLSearchParams({ name })}`;
// for a series we know: the clean address search engines know it by
export const afterAnimeCanonicalPath = (name: string) =>
  `${AFTER_ANIME_PATH}/${slugify(name)}`;

// ---------- the owner's review of readers' fixes ----------

// a reader's correction, as it's kept (the server's anime_fixes row)
export type ReaderFix = {
  id: number;
  slug: string;
  name: string;
  label: string;
  chapter: number | null;
  volume: number | null;
  source: string;
  note: string | null;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  decidedAt: string | null;
};

// what's waiting and what was decided lately. Fails with a 404 for anyone
// who isn't the site's owner
export const getFixesToReview = (signal?: AbortSignal) =>
  getJson<{ waiting: ReaderFix[]; decided: ReaderFix[] }>(
    "/api/after-anime/fixes",
    signal,
  );

// accepts or rejects one; false when it didn't go through
export async function decideFix(id: number, accept: boolean) {
  const res = await apiFetch(`/api/after-anime/fixes/${id}`, {
    method: "POST",
    body: { accept },
  });
  return res.ok;
}
