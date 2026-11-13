// Several files in one import: what kind each is, and their books merged.
// Part of the book import (bookImport.ts lists the parts).
import { type BookSource, type Book } from "./bookTypes";
import { formatOf } from "./bookNames";
import { isGoodreads, isBookCatalogue, isBookshelfApp } from "./bookColumns";

// ---------- several files in one import ----------

// which app a file came from, by its columns
export type FileKind = "goodreads" | "bookcatalogue" | "bookshelf" | "csv";
export const fileKind = (headers: string[]): FileKind =>
  isGoodreads(headers)
    ? "goodreads"
    : isBookCatalogue(headers)
      ? "bookcatalogue"
      : isBookshelfApp(headers)
        ? "bookshelf"
        : "csv";

const KIND_NAME: Record<FileKind, string> = {
  goodreads: "a Goodreads export",
  bookcatalogue: "a Book Catalogue export",
  bookshelf: "a Bookshelf app export",
  csv: "a spreadsheet from another app",
};
const TAB_FOR: Record<FileKind, string> = {
  goodreads: "Goodreads",
  bookcatalogue: "Book Catalogue",
  bookshelf: "Other app",
  csv: "Other app",
};

// why this file can't go in an import from this tab, or null if it can. Each
// tab reads only its own app's files, as only that tab reads their shelves
// right. Other app takes the Bookshelf app or any spreadsheet, one kind per
// import; `importing` is the kind already in this import
export function wrongFile(
  name: string,
  source: BookSource,
  kind: FileKind,
  importing: FileKind | null,
): string | null {
  const wanted: FileKind | null =
    source === "goodreads"
      ? "goodreads"
      : source === "bookcatalogue"
        ? "bookcatalogue"
        : null;
  if (wanted && kind !== wanted) {
    return kind === "csv" || kind === "bookshelf"
      ? source === "goodreads"
        ? `${name} isn't a Goodreads export. Pick the file you downloaded from Goodreads' export page.`
        : `${name} isn't a Book Catalogue export. If it's from another app, choose Other app instead.`
      : `${name} is ${KIND_NAME[kind]}. Add it under ${TAB_FOR[kind]}.`;
  }
  if (!wanted && (kind === "goodreads" || kind === "bookcatalogue")) {
    return `${name} is ${KIND_NAME[kind]}. Add it under ${TAB_FOR[kind]}, which reads its shelves properly.`;
  }
  if (importing && kind !== importing) {
    return `${name} is ${KIND_NAME[kind]}, and this import is ${KIND_NAME[importing]}. Add it in an import of its own.`;
  }
  return null;
}

// a book that's in more than one file counts once: owned or read in either
// counts, it's only "to read" if every file says so, and the later file's
// rating wins when it has one. A file's own repeats are left as they are,
// unless the earlier file has that book too: then they're all that one book
const bookId = (b: Book) => `${formatOf(b)}:${b.title.trim().toLowerCase()}`;
export function mergeBooks(earlier: Book[], later: Book[]): Book[] {
  const out = [...earlier];
  const at = new Map(earlier.map((b, i) => [bookId(b), i]));
  for (const b of later) {
    const i = at.get(bookId(b));
    if (i === undefined) {
      out.push(b);
      continue;
    }
    const a = out[i]!;
    out[i] = {
      ...a,
      owned: a.owned || b.owned,
      read: a.read || b.read,
      reading: a.reading || b.reading,
      planned: a.planned && b.planned,
      rating: b.rating || a.rating,
    };
  }
  return out;
}
