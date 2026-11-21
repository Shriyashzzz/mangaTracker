// A series' shelf seen through an edition: someone collecting Vagabond as
// VIZBIG sees 12 books, not 37 volumes, and keeps their place by the book.
//
// Nothing is stored this way. What they own and where they are stay single
// volumes (manga.ownedList, manga.readVolume), and an edition is only a way
// of looking at them, so switching between Single, VIZBIG and Definitive
// loses nothing, and a shelf of mixed books is shown as it is.
//
// The shelf is a row of SLOTS, in reading order:
//   a book    one of the edition's books, holding several volumes
//   a single  a volume the edition has no book for (Vagabond's VIZBIGs end
//             at vol. 36; vol. 37 is only sold on its own)
// Slots are counted from 1, like volumes, so the shelf component draws them
// the same way. Pure, so the server's Jest can test it.
import type { EditionBook, EditionLine } from "./editions";
import { rangesText } from "./ownedVolumes";

export type Slot = {
  // the series' volumes it holds: three for a VIZBIG, one for a single
  volumes: number[];
  // the edition's book it is; null for a single volume
  book: EditionBook | null;
};

// a series' shelf seen as one edition: what the details page passes around
export type EditionShelf = { line: EditionLine; slots: Slot[] };

// how much of a slot is theirs
export type SlotState = "all" | "part" | "none";

// A line's real books, in order: up to the last one a catalog lists or the
// hand table vouches for (`sure`: Naruto 3-in-1 24, which no catalog lists).
// A volume is in one book: should a catalog ever put one in two, the earlier
// book keeps it and the later one is left off, so nothing is counted twice
export function realBooksOf<
  T extends Pick<EditionBook, "volumes"> & { listed?: boolean; sure?: boolean },
>(line: { books: T[] }): T[] {
  const last = line.books
    .map((book) => Boolean(book.listed || book.sure))
    .lastIndexOf(true);
  const real = last < 0 ? line.books : line.books.slice(0, last + 1);
  const taken = new Set<number>();
  return real.filter((book) => {
    if (!book.volumes.length) return false;
    if (book.volumes.some((v) => taken.has(v))) return false;
    for (const v of book.volumes) taken.add(v);
    return true;
  });
}

// The slots of a series with `total` volumes out, seen as `line`.
//
// Which of the line's books are real: the ones up to the last the catalog
// lists (as editionPlan counts them, lib/editions.ts). The line works out
// books past that so it has no holes, but they may not exist: Vagabond's
// line reaches a "VIZBIG 13" for vol. 37, which was never printed. Those
// volumes are shown as the singles they're sold as. A line with no listed
// book at all keeps what it has (nothing says where it ends), less any book
// that starts past the last volume out
export function slotsOf(
  line: EditionLine,
  total: number,
  // the day, "2026-11-19": a book with a day still to come isn't out, and
  // isn't on the shelf to be ticked (its volumes show as the singles that
  // are). Left out, every book counts
  today?: string,
): Slot[] {
  const comesLater = (book: EditionBook) =>
    Boolean(today) &&
    /^\d{4}-\d{2}-\d{2}$/.test(book.published ?? "") &&
    book.published! > today!;
  const books = realBooksOf(line).filter(
    (book) => Math.min(...book.volumes) <= total && !comesLater(book),
  );
  const inABook = new Set(books.flatMap((book) => book.volumes));
  const singles: Slot[] = [];
  for (let volume = 1; volume <= total; volume++) {
    if (!inABook.has(volume)) singles.push({ volumes: [volume], book: null });
  }
  const slots: Slot[] = [
    ...books.map((book) => ({ volumes: book.volumes, book })),
    ...singles,
  ];
  const firstVolume = (slot: Slot) => Math.min(...slot.volumes);
  return slots.sort((a, b) => firstVolume(a) - firstVolume(b));
}

export function stateOf(slot: Slot, owned: number[]): SlotState {
  const have = slot.volumes.filter((v) => owned.includes(v)).length;
  if (have === slot.volumes.length) return "all";
  return have > 0 ? "part" : "none";
}

// the numbers (from 1) of the slots in a state: the shelf draws these
export const slotsIn = (slots: Slot[], owned: number[], state: SlotState) =>
  slots.flatMap((slot, i) => (stateOf(slot, owned) === state ? [i + 1] : []));

// how much of slot `number` is theirs, from 0 to 1: a part-owned book is
// drawn filled that far
export function shareOwned(slots: Slot[], owned: number[], number: number) {
  const slot = slots[number - 1];
  if (!slot) return 0;
  const have = slot.volumes.filter((v) => owned.includes(v)).length;
  return have / slot.volumes.length;
}

const sorted = (volumes: Iterable<number>) =>
  [...new Set(volumes)].sort((a, b) => a - b);

// What they own after tapping a slot: all of it, or none of it. A part-owned
// slot is the caller's to ask about first (this would complete it)
export function toggleSlot(slot: Slot, owned: number[]) {
  const inSlot = new Set(slot.volumes);
  if (stateOf(slot, owned) === "all")
    return owned.filter((v) => !inSlot.has(v));
  return sorted([...owned, ...slot.volumes]);
}

// What they own after a slide across the shelf left exactly `painted` slots
// standing. A slot they owned part of keeps that part whatever the slide
// did: completing a book they have one volume of is only ever asked. So do
// volumes with no slot (10.5, a vol. 0)
export function volumesAfterPaint(
  slots: Slot[],
  owned: number[],
  painted: number[],
) {
  const standing = new Set(painted);
  const inASlot = new Set(slots.flatMap((slot) => slot.volumes));
  const next = owned.filter((v) => !inASlot.has(v));
  slots.forEach((slot, i) => {
    if (stateOf(slot, owned) === "part") {
      next.push(...slot.volumes.filter((v) => owned.includes(v)));
    } else if (standing.has(i + 1)) {
      next.push(...slot.volumes);
    }
  });
  return sorted(next);
}

// ---------- their place, counted in slots ----------

// the slot (from 1) a volume is in; null when it's in none
export function slotOfVolume(slots: Slot[], volume: number) {
  const at = slots.findIndex((slot) => slot.volumes.includes(volume));
  return at < 0 ? null : at + 1;
}

// how many slots they've read all of, for "read up to VIZBIG 4": reading up
// to vol. 12 is four books of three; up to vol. 11 is still three
export const slotsRead = (slots: Slot[], readVolume: number | null) =>
  slots.filter((slot) => Math.max(...slot.volumes) <= (readVolume ?? 0)).length;

// Whether they've read past the edition's last book: Vagabond's Definitive
// has six so far, and someone on vol. 20 is reading single volumes. Their
// place is then said in volumes ("Definitive 7" isn't a book)
export function readPastTheBooks(slots: Slot[], readVolume: number | null) {
  const inBooks = slots.filter((s) => s.book).flatMap((s) => s.volumes);
  return inBooks.length > 0 && (readVolume ?? 0) > Math.max(...inBooks);
}

// the volume that reading `count` slots comes to, which is what's saved
export const volumeReadAfter = (slots: Slot[], count: number) =>
  count < 1 ? 0 : Math.max(...(slots[count - 1]?.volumes ?? [0]));

// ---------- in words ----------

// "vols. 4–6", "vol. 37"
export const insideOf = (slot: Slot) =>
  `${slot.volumes.length === 1 ? "vol." : "vols."} ${rangesText(slot.volumes)}`;

// what a spine says: the book's own number, or the volume's
export const spineOf = (slot: Slot) =>
  String(slot.book ? slot.book.number : slot.volumes[0]);

// a slot by name, for hovering and for screen readers: "VIZBIG 2, vols.
// 4–6", "Vol. 37, single volume". A part-owned book says which of its
// volumes they have
export function slotName(line: EditionLine, slot: Slot, owned: number[] = []) {
  if (!slot.book) return `Vol. ${slot.volumes[0]}, single volume`;
  const name = `${line.label} ${slot.book.number}`;
  if (stateOf(slot, owned) !== "part") return `${name}, ${insideOf(slot)}`;
  const have = slot.volumes.filter((v) => owned.includes(v));
  const haveText = `${have.length === 1 ? "vol." : "vols."} ${rangesText(have)}`;
  return `${name}: you have ${haveText} of ${rangesText(slot.volumes)}`;
}

// where they are, for the caption's red words: the slot their volume is in.
// Its last volume read is "read up to"; partway through is "reading"
export function placeInSlots(
  slots: Slot[],
  place: { volume: number; kind: "reading" | "read up to" } | null,
) {
  if (!place) return null;
  const number = slotOfVolume(slots, place.volume);
  if (number == null) return null;
  const slot = slots[number - 1]!;
  const finished =
    place.kind === "read up to" && place.volume === Math.max(...slot.volumes);
  const what = slot.book ? `book ${slot.book.number}` : insideOf(slot);
  return {
    slot: number,
    text: `${finished ? "Read up to" : "Reading"} ${what}`,
  };
}

// every one of the edition's books is theirs
export const ownsEveryBook = (slots: Slot[], owned: number[]) =>
  slots
    .filter((slot) => slot.book)
    .every((slot) => stateOf(slot, owned) === "all");

// The line under the shelf: how many of the edition's books are theirs. Once
// they're all theirs, the volumes the edition has no book for are named only
// when those are theirs too. It never says they're "sold singly": an edition
// still coming out (Vagabond Definitive, 6 of 13 books) has more on the way
export function ownedCaption(slots: Slot[], owned: number[]) {
  const books = slots.filter((slot) => slot.book);
  const singles = slots.filter((slot) => !slot.book);
  const booksOwned = books.filter((s) => stateOf(s, owned) === "all").length;
  if (booksOwned < books.length)
    return `You own ${booksOwned} of ${books.length}`;

  const all = `All ${books.length} yours`;
  const theirsToo =
    singles.length > 0 && singles.every((s) => stateOf(s, owned) === "all");
  if (!theirsToo) return all;
  const volumes = singles.flatMap((slot) => slot.volumes);
  return `${all}, and ${volumes.length === 1 ? "vol." : "vols."} ${rangesText(volumes)}`;
}
