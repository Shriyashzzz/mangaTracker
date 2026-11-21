// The CSV files picked for a book import: which may join it, what each
// holds, and why one was left out. Only their bytes are asked for, so the
// browser (a File) and the app (a picked path) open them the same way
import { getJson } from "../api";
import {
  bookFromScan,
  csvText,
  fileKind,
  isbnOnlyRows,
  parseCsv,
  readBooks,
  wrongFile,
  type Book,
  type BookSource,
  type FileKind,
} from "./bookImport";

export type PickedCsv = {
  name: string;
  size: number;
  // the browser's guess at its kind ("text/csv"); an app may not have one
  type?: string;
  lastModified: number;
  bytes: () => Promise<ArrayBuffer | Uint8Array>;
};
// one file's books, under its name
export type BookFile = { name: string; books: Book[] };

// one import holds a few files at most
export const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
// rows with only an ISBN are looked up, a few at a time
const MAX_ISBN_LOOKUPS = 50;

export async function openBookFiles(
  picked: PickedCsv[],
  source: BookSource,
  // the names already in this import, when files join one
  already: string[],
  // the kind of file already in it, so a different app's can't join
  importing: FileKind | null,
): Promise<{ files: BookFile[]; kind: FileKind | null; errors: string[] }> {
  let kind = importing;
  const errors: string[] = [];
  let unknownIsbns = 0;
  const files: BookFile[] = [];
  // oldest first, so the newest export has the last word on ratings
  const inOrder = [...picked].sort((a, b) => a.lastModified - b.lastModified);
  for (const file of inOrder) {
    if (already.length + files.length >= MAX_FILES) {
      errors.push(
        `${file.name} wasn't added: one import takes up to ${MAX_FILES} files.`,
      );
      continue;
    }
    if ([...already, ...files.map((f) => f.name)].includes(file.name)) {
      errors.push(`${file.name} is already in this import.`);
      continue;
    }
    if (!/\.csv$/i.test(file.name) && !/csv/i.test(file.type ?? "")) {
      errors.push(
        `${file.name} isn't a CSV file. Library exports end in .csv.`,
      );
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(
        `${file.name} is too big to be a library export. Check you picked the right one.`,
      );
      continue;
    }
    try {
      const rows = parseCsv(csvText(await file.bytes()));
      // nothing in it, or only its headers: said as it is, not as a
      // missing column or the wrong app's file
      const filled = rows.filter((row) => row.some((cell) => cell.trim()));
      if (!filled.length) {
        errors.push(`${file.name} is empty.`);
        continue;
      }
      const headers = (rows[0] ?? []).map((h) => h.trim());
      // on the Book Catalogue tab, an older export with just a lowercase
      // "title" column (as Book Catalogue writes it) is taken at its word,
      // as it always was; other tabs still want its own columns
      const plainKind = fileKind(headers);
      const thisKind: FileKind =
        source === "bookcatalogue" &&
        plainKind === "csv" &&
        headers.includes("title")
          ? "bookcatalogue"
          : plainKind;
      const wrong = wrongFile(file.name, source, thisKind, kind);
      if (wrong) {
        errors.push(wrong);
        continue;
      }
      const books = readBooks(rows, source);
      // rows with only an ISBN are looked up, as a scanned barcode is
      // (a few at a time, under the scan's own limit)
      const isbns = isbnOnlyRows(rows).slice(0, MAX_ISBN_LOOKUPS);
      for (const isbn of isbns) {
        const scan = await getJson<Parameters<typeof bookFromScan>[0]>(
          `/api/prices/scan/${isbn}`,
        ).catch(() => null);
        // one whose volumes the app can't tell (`unsure`) isn't guessed at
        // here either: it's added by title, where its volumes are typed
        if (scan && !scan.unsure) books.push(bookFromScan(scan));
        else unknownIsbns++;
      }
      if (!books.length) {
        errors.push(
          filled.length === 1
            ? `${file.name} has headers but no books.`
            : source === "csv" && thisKind === "csv"
              ? `We couldn't find a title column in ${file.name}.`
              : `There are no books in ${file.name}.`,
        );
        continue;
      }
      kind = thisKind;
      files.push({ name: file.name, books });
    } catch {
      errors.push(`${file.name} couldn't be read. Try exporting it again.`);
    }
  }
  if (unknownIsbns)
    errors.push(
      `${unknownIsbns} ${unknownIsbns === 1 ? "row has" : "rows have"} only an ISBN we couldn't read a book and its volumes from. Add ${unknownIsbns === 1 ? "it" : "them"} by title.`,
    );
  return { files, kind, errors };
}
