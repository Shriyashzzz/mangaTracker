// Every series with an omnibus or deluxe line, for the /editions page: each
// line with its books, and the volumes each book holds (the server's
// prices/pagesService.ts getEditionsIndex, from saved lines only)
import { getJson } from "./api";

export type EditionsEntry = {
  name: string;
  slug: string;
  coverUrl: string | null;
  lines: {
    // the series page opens on it: ?edition=<key>
    key: string;
    // "VIZBIG", "Deluxe", "3-in-1"
    label: string;
    books: number;
    // the volumes the line holds, first and last
    from: number;
    to: number;
    // each book in order, with the volumes it holds and its release date:
    // listed books only, out or confirmed and coming
    spans: {
      number: number;
      from: number;
      to: number;
      published: string | null;
    }[];
  }[];
};

export const getEditionsIndex = (signal?: AbortSignal) =>
  getJson<EditionsEntry[]>("/api/prices/editions-index", signal);
