// The shelf as a backup file, one row a series. Pure: no network code, so
// the round trip (written here, read back by imports/bookImport.ts) is
// tested end to end (server/src/tests/shelf/backupRoundTrip.test.ts).
import { booksToCell, type NewBook } from "./books";
import { ownedOf, rangesText } from "./ownedVolumes";
import type { Manga } from "./types";

// a spreadsheet treats a cell starting with these as a formula
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const shelfToCsv = (
  manga: Manga[],
  // each series' books, by its id (lib/books.ts)
  books: Record<number, NewBook[]> = {},
) =>
  [
    [
      "Title",
      "Type",
      "Status",
      "Chapter",
      "Read volume",
      "Tracked by",
      "Owned volumes",
      "Rating",
      "Genre",
      "Notes",
      "Books",
      "Collecting",
    ],
    ...manga.map((m) => [
      m.name,
      m.lightNovel ? "Light novel" : "Manga",
      m.status ? "Finished" : m.planned ? "To read" : "Reading",
      m.bookmark,
      m.readVolume,
      m.byVolume ? "Volume" : "Chapter",
      // every one they own, as ranges ("1–5, 8"), so the import reads it back
      // exactly (bookImport isOwnExport)
      rangesText(ownedOf(m)),
      m.rating,
      m.genre,
      m.description,
      // the books behind the volumes, with their ISBNs and editions
      booksToCell(books[m.id] ?? []),
      // the edition they buy it in ("deluxe"), when they've said
      m.edition ?? "",
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
