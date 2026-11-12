// The books behind a series' owned volumes: one per physical book, with its
// ISBN, edition and the volumes it holds (server: models/bookQueries.ts). A
// barcode scan or an import writes them; a volume ticked by hand has none.
import { parseVolumes, rangesText } from "./ownedVolumes";

export type EditionKind = "single" | "omnibus" | "deluxe" | "boxset";

export type OwnedBook = {
  id: number;
  isbn13: string | null;
  edition: EditionKind;
  // its number in that edition: Deluxe 2
  number: number | null;
  title: string | null;
  volumes: number[];
};
export type NewBook = Omit<OwnedBook, "id">;

// which edition a book is, from its title and how many volumes it holds
export const editionOf = (title: string, volumes: number[]): EditionKind =>
  /\bbox(ed)?[\s-]?set\b|\bcomplete (collection|set|series)\b/i.test(title)
    ? "boxset"
    : /\bdeluxe\b|\b(perfect|collector'?s|master|ultimate|fullmetal) edition\b|\bkanzenban\b/i.test(
          title,
        )
      ? "deluxe"
      : volumes.length > 1 || /\bomnibus\b|\b\d-in-\d\b/i.test(title)
        ? "omnibus"
        : "single";

// a book's number in its edition, when its title says: "…Deluxe Volume 2"
export const bookNumberOf = (title: string): number | null => {
  const found = /(?:vol(?:ume)?\.?|book|#|omnibus)\s*(\d{1,3})\b/i.exec(title);
  return found ? Number(found[1]) : null;
};

export const newBook = (
  title: string,
  volumes: number[],
  isbn13?: string | null,
): NewBook => {
  const edition = editionOf(title, volumes);
  return {
    isbn13: isbn13 && /^97[89]\d{10}$/.test(isbn13) ? isbn13 : null,
    edition,
    // a single's number is its volume
    number: edition === "single" ? (volumes[0] ?? null) : bookNumberOf(title),
    title: title.slice(0, 200) || null,
    volumes: [...new Set(volumes)].sort((a, b) => a - b),
  };
};

const EDITION_WORDS: Record<EditionKind, string> = {
  single: "Vol.",
  omnibus: "Omnibus",
  deluxe: "Deluxe",
  boxset: "Box set",
};

// "Deluxe 2 (vols. 4–6)", "Vol. 12", "Box set (vols. 1–27)"
export const bookLabel = (
  b: Pick<OwnedBook, "edition" | "number" | "volumes">,
) => {
  if (b.edition === "single")
    return `Vol. ${b.number ?? rangesText(b.volumes)}`;
  const name = [EDITION_WORDS[b.edition], b.number].filter(Boolean).join(" ");
  return `${name} (${b.volumes.length === 1 ? "vol." : "vols."} ${rangesText(b.volumes)})`;
};

// a series' books in one cell of the backup, and read back from it:
// "9781506711980 deluxe 1: 1–3; - single 12: 12"
export const booksToCell = (books: NewBook[]) =>
  books
    .map(
      (b) =>
        `${b.isbn13 ?? "-"} ${b.edition} ${b.number ?? "-"}: ${rangesText(b.volumes)}`,
    )
    .join("; ");
export const booksFromCell = (text: string): NewBook[] =>
  text.split(";").flatMap((part) => {
    const found =
      /^\s*(97[89]\d{10}|-)\s+(single|omnibus|deluxe|boxset)\s+([\d.]+|-):\s*(.+?)\s*$/.exec(
        part,
      );
    const volumes = found ? parseVolumes(found[4]!) : null;
    if (!found || !volumes?.length) return [];
    return [
      {
        isbn13: found[1] === "-" ? null : found[1]!,
        edition: found[2] as EditionKind,
        number: found[3] === "-" ? null : Number(found[3]),
        title: null,
        volumes,
      },
    ];
  });
