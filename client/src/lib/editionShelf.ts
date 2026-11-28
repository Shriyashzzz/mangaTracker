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
//   another edition's book
//             one they recorded, where this edition has no book: their
//             VIZBIG 7 on a shelf seen as Definitive, whose six books end
//             at vol. 18
// Slots are counted from 1, like volumes, so the shelf component draws them
// the same way. Pure, so the server's Jest can test it.
import type { EditionBook, EditionLine } from "./editions";
import { EDITION_WORDS } from "./books";
import { rangesText } from "./ownedVolumes";

export type Slot = {
  // the series' volumes it holds: three for a VIZBIG, one for a single
  volumes: number[];
  // the edition's book it is; null for a single volume
  book: EditionBook | null;
  // a book of another edition they recorded, where this edition has no
  // book: their VIZBIG 7 (vols. 19-21) on a shelf seen as Definitive
  otherEdition?: OtherEditionBook;
};
export type OtherEditionBook = {
  label: string;
  number: number | null;
  kind: "omnibus" | "deluxe";
};

// a book they recorded: what's read off it to name and place it
type Recorded = {
  label?: string | null;
  edition?: string | null;
  number?: number | null;
  volumes: number[];
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

// THE books of a line that are on the shelf: its real books that are out.
// A book with a day still to come isn't, and can't be ticked: its volumes
// are the singles that are out. `today` is "2026-11-19"; left out, every
// book counts. The server's ticking reads the same rule (its copy, util/
// shelf/realBooks.ts shelfBooks, kept in step by tests/shelf/rulesInStep),
// so a tick never records a book the shelf doesn't show
export function shelfBooksOf<T extends EditionBook>(
  line: { books: T[] },
  today?: string,
): T[] {
  const comesLater = (book: T) => {
    const day = fullDayOf(book.published);
    return Boolean(today && day && day > today);
  };
  return realBooksOf(line).filter((book) => !comesLater(book));
}

// a day given in full, "2026-03-04": the only kind that's ever said. A
// year alone ("2027") says nothing about whether a book is out
const FULL_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const fullDayOf = (published?: string | null) =>
  published && FULL_DAY.test(published) ? published : null;

const sorted = (volumes: Iterable<number>) =>
  [...new Set(volumes)].sort((a, b) => a - b);

// The books they recorded of another edition that stand where `line` has
// no book: all their volumes are out (up to `total`) and in no book of the
// line. Vagabond seen as Definitive (books end at vol. 18) with VIZBIG 7
// recorded: VIZBIG 7 stands for vols. 19-21. A single volume or a box set
// isn't one (a box set is single volumes in a box), nor is a book that
// shares a volume with one of the line's or with another of theirs
function otherEditionBooks(
  recorded: Recorded[],
  inABook: Set<number>,
  total: number,
): { volumes: number[]; otherEdition: OtherEditionBook }[] {
  const taken = new Set(inABook);
  const found: { volumes: number[]; otherEdition: OtherEditionBook }[] = [];
  const byFirstVolume = [...recorded].sort(
    (a, b) => Math.min(...a.volumes) - Math.min(...b.volumes),
  );
  for (const book of byFirstVolume) {
    if (book.edition !== "omnibus" && book.edition !== "deluxe") continue;
    if (book.volumes.length < 2) continue;
    if (book.volumes.some((v) => v > total || taken.has(v))) continue;
    for (const v of book.volumes) taken.add(v);
    found.push({
      volumes: sorted(book.volumes),
      otherEdition: {
        label: book.label ?? EDITION_WORDS[book.edition],
        number: book.number ?? null,
        kind: book.edition,
      },
    });
  }
  return found;
}

// The slots of a series with `total` volumes out, seen as `line`.
//
// Which of the line's books are real: the ones up to the last the catalog
// lists (as editionPlan counts them, lib/editions.ts). The line works out
// books past that so it has no holes, but they may not exist: Vagabond's
// line reaches a "VIZBIG 13" for vol. 37, which was never printed. Those
// volumes are shown as the singles they're sold as. A line with no listed
// book at all keeps what it has (nothing says where it ends), less any book
// that starts past the last volume out.
// Where the line has no book, a book of another edition they recorded
// stands as itself (otherEditionBooks), and the rest are single volumes
export function slotsOf(
  line: EditionLine,
  total: number,
  // the day, "2026-11-19": a book with a day still to come isn't out
  // (shelfBooksOf). Left out, every book counts
  today?: string,
  // the books they've recorded (useEditions' keptWhole)
  recorded: Recorded[] = [],
): Slot[] {
  const books = shelfBooksOf(line, today).filter(
    (book) => Math.min(...book.volumes) <= total,
  );
  const inABook = new Set(books.flatMap((book) => book.volumes));
  const others = otherEditionBooks(recorded, inABook, total);
  const placed = new Set([
    ...inABook,
    ...others.flatMap((book) => book.volumes),
  ]);
  const singles: Slot[] = [];
  for (let volume = 1; volume <= total; volume++) {
    if (!placed.has(volume)) singles.push({ volumes: [volume], book: null });
  }
  const slots: Slot[] = [
    ...books.map((book) => ({ volumes: book.volumes, book })),
    ...others.map((book) => ({ ...book, book: null })),
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

// a single volume, drawn thin: not the edition's book, nor another's
export const isSingleSlot = (slot: Slot) => !slot.book && !slot.otherEdition;

// what a spine says: the book's own number, or the volume's
export function spineOf(slot: Slot) {
  if (slot.book) return String(slot.book.number);
  if (slot.otherEdition?.number != null)
    return String(slot.otherEdition.number);
  return String(slot.volumes[0]);
}

// another edition's book by name: "VIZBIG 7"
const otherEditionName = (book: OtherEditionBook) =>
  [book.label, book.number].filter(Boolean).join(" ");

// a slot by name, for hovering and for screen readers: "VIZBIG 2, vols.
// 4–6", "Vol. 37, single volume". A part-owned book says which of its
// volumes they have
export function slotName(line: EditionLine, slot: Slot, owned: number[] = []) {
  if (isSingleSlot(slot)) return `Vol. ${slot.volumes[0]}, single volume`;
  const name = slot.book
    ? `${line.label} ${slot.book.number}`
    : otherEditionName(slot.otherEdition!);
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
  let what = insideOf(slot);
  if (slot.book) what = `book ${slot.book.number}`;
  else if (slot.otherEdition) what = otherEditionName(slot.otherEdition);
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
// when those are theirs too (another edition's books, their VIZBIG 7 on a
// Definitive shelf, are on the shelf by name, so aren't counted again here).
// It never says they're "sold singly": an edition
// still coming out (Vagabond Definitive, 6 of 13 books) has more on the way
export function ownedCaption(slots: Slot[], owned: number[]) {
  const books = slots.filter((slot) => slot.book);
  const singles = slots.filter(isSingleSlot);
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

// A book's spine on the shelf: the edition it really is when they've
// recorded it ("Definitive", though the shelf is being looked at as VIZBIG),
// or else the edition picked. A single volume is "Singles". Its kind says
// how thick the spine is drawn: a deluxe book the thickest, an omnibus a
// little less, a single volume thin.
// One rule, so the shelf and "Your books" can't call a book two things
export type RunKind = "single" | "omnibus" | "deluxe";
export const runOf = (
  slot: Slot,
  line: EditionLine,
  recorded: Recorded[],
): { label: string; kind: RunKind } => {
  if (slot.otherEdition)
    return { label: slot.otherEdition.label, kind: slot.otherEdition.kind };
  if (!slot.book) return { label: "Singles", kind: "single" };
  const same = slot.volumes.join();
  const book = recorded.find((b) => b.volumes.join() === same);
  const kind =
    book?.edition === "deluxe" || book?.edition === "omnibus"
      ? book.edition
      : line.kind;
  return { label: book?.label ?? line.label, kind };
};
export const runLabelOf = (
  slot: Slot,
  line: EditionLine,
  recorded: Recorded[],
) => runOf(slot, line, recorded).label;
