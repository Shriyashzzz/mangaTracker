// The words of the book import page: each app's name, how to get its export,
// and the line that says what a file held.
import { type BookSeries, type BookSource } from "../../lib/imports/bookImport";

export const APP_NAME: Record<BookSource, string> = {
  goodreads: "Goodreads",
  bookcatalogue: "Book Catalogue",
  csv: "your app's",
};

export const series = (n: number) => `${n.toLocaleString()} series`;
export const books = (n: number) =>
  `${n.toLocaleString()} book${n === 1 ? "" : "s"}`;

// each row is a book; volumes of one series come in as one
export function foundLine(found: BookSeries[]) {
  let rows = 0;
  for (const s of found) rows += s.books;
  // one book a series: nothing was grouped, so there's nothing more to say
  if (rows === found.length) return `${books(rows)} found`;
  return `${books(rows)} found, grouped into ${series(found.length)}`;
}

export const HOW: Record<
  BookSource,
  { step: string; link?: { href: string; label: string } }
> = {
  goodreads: {
    step: "On Goodreads, go to My Books, then Import and export, and press Export Library. Download the file once it's ready.",
    link: {
      href: "https://www.goodreads.com/review/import",
      label: "Open Goodreads' export page",
    },
  },
  bookcatalogue: {
    step: "In Book Catalogue, open the menu and export your books to a CSV file. Go to Admin & Prefs or Settings, depending on your version. Then drop the file.",
  },
  csv: {
    // the columns bookImport.ts reads (any of these names, any order)
    step: "Export your library from your app as a CSV file. It needs a Title or ISBN column; Series, Volume (or Number), an Owned or Purchased column, Rating and Format help if your app has them. A box set's volumes are asked for if the title doesn't say. A Manga Tracker export (Settings) restores volumes, chapter, status, rating and notes; a series already on your shelf only gets what it lacks.",
  },
};
