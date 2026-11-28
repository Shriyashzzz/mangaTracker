// The books behind a series' owned volumes: one per physical book, with its
// ISBN, edition and the volumes it holds (server: models/bookQueries.ts). A
// barcode scan or an import writes them; a volume ticked by hand has none.
import { parseVolumes, rangesText } from "./ownedVolumes";

type EditionKind = "single" | "omnibus" | "deluxe" | "boxset";

export type OwnedBook = {
  id: number;
  isbn13: string | null;
  edition: EditionKind;
  // its number in that edition: Deluxe 2
  number: number | null;
  title: string | null;
  volumes: number[];
  // what they paid for it, in cents, and the day they bought it
  // ("2026-01-05"; the server sends the day with a time on the end)
  paidCents?: number | null;
  boughtOn?: string | null;
  // lent out: to whom, and the day it was ("2026-11-03", with a time on the
  // end from the server)
  lentTo?: string | null;
  lentOn?: string | null;
  // its edition as the app says it ("Definitive", "VIZBIG"), read from its
  // title by the server; missing for a single volume and on a new book
  label?: string | null;
};
export type NewBook = Omit<OwnedBook, "id" | "label">;

// the day alone, however it came
export const dayOf = (day: string | null | undefined) =>
  day ? day.slice(0, 10) : null;

// "$12.99" typed in a box, as cents; null for nothing or nonsense
export const centsOf = (text: string): number | null => {
  const amount = Number(text.replace(/[$,\s]/g, ""));
  return text.trim() &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    amount <= 100000
    ? Math.round(amount * 100)
    : null;
};

// what some books cost in all, and how many of them say
export const spentOn = (books: Pick<OwnedBook, "paidCents">[]) => {
  const paid = books.flatMap((b) => (b.paidCents != null ? [b.paidCents] : []));
  return { cents: paid.reduce((sum, c) => sum + c, 0), books: paid.length };
};

// which edition a book is, from its title and how many volumes it holds
const editionOf = (title: string, volumes: number[]): EditionKind =>
  /\bbox(ed)?[\s-]?set\b|\bcomplete (collection|set|series)\b/i.test(title)
    ? "boxset"
    : /\bdeluxe\b|\b(perfect|collector'?s|master|ultimate|fullmetal|black|eternal|definitive|anniversary) edition\b|\bkanzenban\b/i.test(
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

export const EDITION_WORDS: Record<EditionKind, string> = {
  single: "Vol.",
  omnibus: "Omnibus",
  deluxe: "Deluxe",
  boxset: "Box set",
};

// "Deluxe 2 (vols. 4–6)", "Vol. 12", "Box set (vols. 1–27)"
// its own edition's name when the server sent one: "Definitive 2 (vols. 4–6)",
// not just "Deluxe 2"
export const bookLabel = (
  b: Pick<OwnedBook, "edition" | "number" | "volumes" | "label">,
) => {
  if (b.edition === "single" && !b.label)
    return `Vol. ${b.number ?? rangesText(b.volumes)}`;
  const edition = b.label ?? EDITION_WORDS[b.edition];
  // a box set has no number worth saying beside its name
  const name = [edition, b.number].filter(Boolean).join(" ");
  return `${name} (${b.volumes.length === 1 ? "vol." : "vols."} ${rangesText(b.volumes)})`;
};

// One cover per edition they own of a series, for the cover picker: each
// edition's first book that has an ISBN (its cover is looked up by it), named
// as the book is ("Definitive 1", "Vol. 11"). Only books they own, so an
// edition they have none of is never offered
export function ownCoversOf(books: OwnedBook[]) {
  const first = new Map<string, OwnedBook>();
  const byNumber = [...books].sort(
    (a, b) => Math.min(...a.volumes, 1e6) - Math.min(...b.volumes, 1e6),
  );
  for (const book of byNumber) {
    if (!book.isbn13) continue;
    const edition = book.label ?? book.edition;
    if (!first.has(edition)) first.set(edition, book);
  }
  return [...first.values()].map((book) => ({
    url: `/api/prices/cover/${book.isbn13}`,
    name: bookLabel(book).replace(/\s*\(.*\)$/, ""),
  }));
}

// a series' books in one cell of the backup, and read back from it:
// "9781506711980 deluxe 1 [Berserk Deluxe Edition Volume 1]: 1–3 @49.99
// 2026-01-05; - single 12: 12". An edition's book keeps its own title in
// brackets, so a Perfect Edition isn't only "deluxe" (files from before have
// none, and still read). What was paid ("@") and the day bought follow the
// volumes, when they're known
const titleInCell = (b: NewBook) =>
  b.edition !== "single" && b.title
    ? ` [${b.title
        .replace(/[[\];]/g, " ")
        .replace(/\s+/g, " ")
        .trim()}]`
    : "";
export const booksToCell = (books: NewBook[]) =>
  books
    .map((b) =>
      [
        `${b.isbn13 ?? "-"} ${b.edition} ${b.number ?? "-"}${titleInCell(b)}: ${rangesText(b.volumes)}`,
        b.paidCents != null ? `@${(b.paidCents / 100).toFixed(2)}` : null,
        dayOf(b.boughtOn),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join("; ");
export const booksFromCell = (text: string): NewBook[] =>
  text.split(";").flatMap((part) => {
    // the price and the day off the end first: the volumes are what's left
    const day = /\s(\d{4}-\d{2}-\d{2})\s*$/.exec(part);
    const undated = day ? part.slice(0, day.index) : part;
    const paid = /\s@(\d+(?:\.\d{1,2})?)\s*$/.exec(undated);
    const rest = paid ? undated.slice(0, paid.index) : undated;
    const found =
      /^\s*(97[89]\d{10}|-)\s+(single|omnibus|deluxe|boxset)\s+([\d.]+|-)(?:\s+\[([^\]]*)\])?:\s*(.+?)\s*$/.exec(
        rest,
      );
    const volumes = found ? parseVolumes(found[5]!) : null;
    if (!found || !volumes?.length) return [];
    return [
      {
        isbn13: found[1] === "-" ? null : found[1]!,
        edition: found[2] as EditionKind,
        number: found[3] === "-" ? null : Number(found[3]),
        title: found[4]?.trim() || null,
        volumes,
        ...(paid ? { paidCents: Math.round(Number(paid[1]) * 100) } : {}),
        ...(day ? { boughtOn: day[1]! } : {}),
      },
    ];
  });
