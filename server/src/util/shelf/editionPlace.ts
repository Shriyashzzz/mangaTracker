// Where a reader is in the edition they collect, for a shelf card: someone
// collecting Vagabond as VIZBIG who has read up to vol. 12 is on "VIZBIG 4",
// and owns "VIZBIG 1–4". Worked out from the series' edition line and the
// single volumes everything is saved as. The details page has its own, fuller
// rule for its shelf (client/src/lib/editionShelf.ts).
//
// Only what's certain is said. A place or a shelf that doesn't fit the
// edition's books (vol. 37, which VIZBIG has no book for; one volume of a
// book bought on its own) is left null, and the card says it in volumes.

type Book = { number: number; volumes: number[]; listed?: boolean };
type Line = { label: string; books: Book[] };

export type EditionPlace = {
  // "VIZBIG", "Deluxe"
  label: string;
  // the book their read volume is in; null when it's in none, or none read
  read: number | null;
  // the books they own, when every volume they own is in a book they own
  // all of; null when it isn't so (or they own nothing)
  owned: number[] | null;
};

export function editionPlaceOf(
  line: Line,
  readVolume: number | null,
  owned: number[],
): EditionPlace {
  // the line's real books: up to the last one the catalog lists. Past that
  // they're only worked out, and may never have been printed (the page's
  // slotsOf has the same rule: change both together)
  const lastListed = line.books.map((book) => book.listed).lastIndexOf(true);
  const books =
    lastListed < 0 ? line.books : line.books.slice(0, lastListed + 1);
  const holding = (volume: number) =>
    books.find((book) => book.volumes.includes(volume)) ?? null;
  const read = readVolume ? (holding(readVolume)?.number ?? null) : null;

  const mine = new Set(owned);
  const whole = books.filter(
    (book) => book.volumes.length > 0 && book.volumes.every((v) => mine.has(v)),
  );
  const inWholeBooks = new Set(whole.flatMap((book) => book.volumes));
  const allInBooks =
    owned.length > 0 && owned.every((v) => inWholeBooks.has(v));

  return {
    label: line.label,
    read,
    owned: allInBooks ? whole.map((book) => book.number) : null,
  };
}
