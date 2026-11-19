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

// The slots of a series with `total` volumes out, seen as `line`. A book of
// the line that starts past the last volume out isn't published yet, and is
// left off
export function slotsOf(line: EditionLine, total: number): Slot[] {
  const books = line.books.filter(
    (book) => book.volumes.length > 0 && Math.min(...book.volumes) <= total,
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

// the books that became wholly theirs between two lists of owned volumes:
// each is recorded under "Your books"
export const booksGained = (slots: Slot[], before: number[], after: number[]) =>
  slots.flatMap((slot) =>
    slot.book &&
    stateOf(slot, before) !== "all" &&
    stateOf(slot, after) === "all"
      ? [slot.book]
      : [],
  );

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
// 4–6", "Vol. 37, sold on its own". A part-owned book says which of its
// volumes they have
export function slotName(line: EditionLine, slot: Slot, owned: number[] = []) {
  if (!slot.book) return `Vol. ${slot.volumes[0]}, sold on its own`;
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

// The line under the shelf: how many of the edition's books are theirs.
// Only once every book is theirs does it mention the volumes the edition
// has no book for, which are all that's left to get
export function ownedCaption(slots: Slot[], owned: number[]) {
  const books = slots.filter((slot) => slot.book);
  const singles = slots.filter((slot) => !slot.book);
  const booksOwned = books.filter((s) => stateOf(s, owned) === "all").length;
  if (booksOwned < books.length)
    return `You own ${booksOwned} of ${books.length}`;

  const all = `All ${books.length} yours`;
  if (!singles.length) return all;
  const volumes = singles.flatMap((slot) => slot.volumes);
  const vols = `${volumes.length === 1 ? "vol." : "vols."} ${rangesText(volumes)}`;
  const theirsToo = singles.every((s) => stateOf(s, owned) === "all");
  if (theirsToo) return `${all}, and ${vols}`;
  const sold = volumes.length === 1 ? "is sold on its own" : "are sold singly";
  return `${all} · ${vols} ${sold}`;
}
