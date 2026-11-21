// Every series with an omnibus or deluxe line, for the /editions page: each
// line with its books, and the volumes each book holds (the server's
// prices/pagesService.ts getEditionsIndex, from saved lines only)
import { apiFetch, errorMessages, getJson } from "./api";
import { orOffline } from "./offline";

export type EditionsEntry = {
  name: string;
  slug: string;
  coverUrl: string | null;
  lines: {
    // the series page opens on it: ?edition=<key>
    key: string;
    // "VIZBIG", "Deluxe", "3-in-1"
    label: string;
    // its real books (the series page's rule, lib/editionShelf.ts
    // realBooksOf) with what each holds, whether a catalog lists it or it's
    // vouched for, and its date
    spans: {
      number: number;
      from: number;
      to: number;
      listed: boolean;
      sure: boolean;
      published: string | null;
      // its own price page, when a catalog has it
      isbn13: string | null;
      title: string | null;
    }[];
  }[];
};

export const getEditionsIndex = (signal?: AbortSignal) =>
  getJson<EditionsEntry[]>("/api/prices/editions-index", signal);

// ---------- readers reporting a book no catalog lists ----------
// (server util/shelf/editionReports.ts): it shows once three readers say the
// same, or the site's owner approves it

export type BookToReport = {
  name: string;
  edition: string;
  number: number;
  volumes: number[];
};

// "" when it went through, else what to tell them
export async function reportBook(book: BookToReport) {
  const res = await apiFetch("/api/editions/reports", {
    method: "POST",
    body: book,
  });
  if (res.ok) return "";
  return (
    (await errorMessages(res))[0] ?? orOffline("That didn't send. Try again.")
  );
}

export type ReportedBook = {
  // the series' key, as decisions name it
  series: string;
  name: string;
  edition: string;
  number: number;
  // each set of volumes readers said, and how many said it
  said: { volumes: number[]; readers: number }[];
  lastAt: string;
  status: "waiting" | "agreed" | "approved" | "rejected";
};

// the owner's review page; anyone else is refused
export const getReportedBooks = (signal?: AbortSignal) =>
  getJson<ReportedBook[]>("/api/editions/reports", signal);

// approves or rejects one; false when it didn't go through
export async function decideReportedBook(
  book: ReportedBook,
  volumes: number[],
  approve: boolean,
) {
  const res = await apiFetch("/api/editions/reports/decide", {
    method: "POST",
    body: {
      series: book.series,
      edition: book.edition,
      number: book.number,
      volumes,
      approve,
    },
  });
  return res.ok;
}
