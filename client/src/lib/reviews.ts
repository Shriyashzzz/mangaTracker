// Readers' reviews of a volume: what the server sends, and the calls that
// read, write and flag them. The server's side is server/src/reviews/
// (reviews.ts sends these shapes; reviewRules.ts holds the rules).
import { apiFetch, errorMessages, getJson } from "./api";

// the most characters a review's words can have (the server's MOST_WORDS)
export const MOST_WORDS = 500;

// one review, as anyone may see it
export type Review = {
  id: number;
  rating: number;
  text: string;
  // behind a tap: its writer said so, or enough readers did
  spoiler: boolean;
  // the writer's display name, never their username
  by: string;
  avatar: string | null;
  writtenAt: string;
  edited: boolean;
  yours: boolean;
  // readers reported it: hidden from everyone but its writer for now
  hidden: boolean;
};

// may the viewer review this volume: yes, or why not
export type MayWrite = "yes" | "sign-in" | "not-read";

export type VolumeReviews = {
  // every rating counts here; `reviews` are the ones with words
  count: number;
  average: number | null;
  // how many gave 1 star, 2 … 5
  spread: number[];
  reviews: Review[];
  yours: Review | null;
  mayWrite: MayWrite;
};

export const getVolumeReviews = (isbn13: string, signal?: AbortSignal) =>
  getJson<VolumeReviews>(`/api/reviews/volume/${isbn13}`, signal);

export type ReviewDraft = { rating: number; text: string; spoiler: boolean };

// writes the viewer's review of a volume, or writes over it. The saved
// review, or the server's reason it wasn't
export async function saveReview(
  isbn13: string,
  draft: ReviewDraft,
): Promise<{ review: Review } | { problem: string }> {
  const res = await apiFetch(`/api/reviews/volume/${isbn13}`, {
    method: "PUT",
    body: draft,
  }).catch(() => null);
  if (!res) return { problem: "That didn't save. Check your connection." };
  if (!res.ok) return { problem: (await errorMessages(res))[0]! };
  return { review: (await res.json()) as Review };
}

// takes the viewer's review away; false when it didn't go through
export async function deleteReview(isbn13: string) {
  const res = await apiFetch(`/api/reviews/volume/${isbn13}`, {
    method: "DELETE",
  }).catch(() => null);
  return Boolean(res?.ok);
}

// "this is a spoiler" or "report", on someone else's review
export async function flagReview(id: number, kind: "spoiler" | "report") {
  const res = await apiFetch(`/api/reviews/${id}/flag`, {
    method: "POST",
    body: { kind },
  }).catch(() => null);
  return Boolean(res?.ok);
}

// a series' ratings added up, and each rated volume's own
export type SeriesReviews = {
  count: number;
  average: number | null;
  volumes: {
    isbn13: string;
    volume: number | null;
    count: number;
    average: number | null;
    written: number;
  }[];
};

export const getSeriesReviews = (name: string, signal?: AbortSignal) =>
  getJson<SeriesReviews>(
    `/api/reviews/series?${new URLSearchParams({ name })}`,
    signal,
  );

// For a series on the viewer's shelf: the volumes they could rate next
// (the ones they've read first, latest first), and the reviews they've
// written of it, latest volume first. The server's shelfReviews
export type ShelfVolume = { isbn13: string; volume: number };
export type WrittenReview = ShelfVolume & { review: Review };
export type ShelfReviews = { toRate: ShelfVolume[]; written: WrittenReview[] };
export const getShelfReviews = (mangaId: number, signal?: AbortSignal) =>
  getJson<ShelfReviews>(`/api/reviews/shelf?manga=${mangaId}`, signal);

// ---------- the site owner's list ----------

export type ReportedReview = {
  id: number;
  isbn13: string;
  // the volume's name, when the book is on file
  title: string | null;
  rating: number;
  text: string;
  by: string;
  writtenAt: string;
  reports: number;
  hidden: boolean;
};

// fails with a 404 for anyone who isn't the site's owner
export const getReportedReviews = (signal?: AbortSignal) =>
  getJson<ReportedReview[]>("/api/reviews/reported", signal);

// keeps a reported review (its reports are cleared) or removes it for good
export async function decideReview(id: number, keep: boolean) {
  const res = await apiFetch(`/api/reviews/${id}/decide`, {
    method: "POST",
    body: { keep },
  }).catch(() => null);
  return Boolean(res?.ok);
}
