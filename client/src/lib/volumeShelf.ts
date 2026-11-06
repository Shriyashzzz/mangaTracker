// The details page's shelf of volumes (components/volumeShelf): every volume of
// the series in one row of fixed size, theirs standing in ink. When the books
// are too thin to read, the ones near the pointer grow like a magnifier: the
// one pointed at reaches full size where it sits, and the books towards each
// end squeeze up to make room, so the row still fills the shelf exactly, ends
// included. Pure, so the server's Jest can test it.

// a book at full size, as on the add form's picker
export const BOOK = 22;
// how many neighbours grow with it
const SPREAD = 2.6;
// a finger hits a book this wide without help: one tap ticks it
export const TAPPABLE = 14;
// wide enough for its number, and for room between books
export const NUMBERED = 13;
export const SPACED = 5;

// squeezes books into `room` px, keeping each at least `thinnest` wide
function squeeze(widths: number[], room: number, thinnest: number) {
  const floor = widths.length * thinnest;
  const have = widths.reduce((a, b) => a + b, 0);
  if (have <= room || have <= floor) return widths;
  const k = Math.max(0, room - floor) / (have - floor);
  return widths.map((w) => thinnest + (w - thinnest) * k);
}

// each book's width. `aimed` is where the pointer is, counted in resting books
// from the left (0 to total); null is resting. The book aimed at grows to
// full size right where it sits at rest, its neighbours less, and the books
// between it and each end are squeezed to make room, so the row always fills
// the shelf exactly: nothing moves under the pointer, and the first and last
// volumes never leave the shelf
export function bookWidths(
  total: number,
  width: number,
  aimed: number | null,
): number[] {
  const base = Math.min(BOOK, width / total);
  if (aimed == null || base >= BOOK) return Array(total).fill(base);
  const grown = Array.from(
    { length: total },
    (_, i) =>
      base + (BOOK - base) * Math.exp(-(((i + 0.5 - aimed) / SPREAD) ** 2)),
  );
  // squeezed books stay a sliver, and all of them still fit beside a full one
  const thinnest = Math.min(1, base, (width - BOOK) / (total - 1));
  const k = Math.min(total - 1, Math.max(0, Math.floor(aimed)));
  const into = aimed - k;
  const own = grown[k]!;
  const left = grown.slice(0, k);
  const right = grown.slice(k + 1);
  // room either side of the aimed book, keeping the aimed point where it was
  // (or as near as the ends allow)
  const at = aimed * base;
  let leftRoom = Math.max(left.length * thinnest, at - into * own);
  const rightRoom = Math.max(right.length * thinnest, width - leftRoom - own);
  // near the right end there may not be room: the left side gives it up
  leftRoom = width - own - rightRoom;
  return [
    ...squeeze(left, leftRoom, thinnest),
    own,
    ...squeeze(right, rightRoom, thinnest),
  ];
}

// the pointer's x on the shelf, in resting books
export const aimAt = (x: number, total: number, width: number) =>
  Math.min(total - 0.001, Math.max(0, x / Math.min(BOOK, width / total)));

// the book (1 to total) at x on the shelf, as laid out; null past the end
export function bookAt(widths: number[], x: number): number | null {
  if (x < 0) return null;
  let edge = 0;
  for (let i = 0; i < widths.length; i++) {
    edge += widths[i]!;
    if (x < edge) return i + 1;
  }
  return null;
}

// what they own once this volume is ticked or unticked. Halves and specials
// (10.5, 0) aren't on the shelf, so they're kept as they are
export function toggled(owned: number[], volume: number): number[] {
  return owned.includes(volume)
    ? owned.filter((v) => v !== volume)
    : [...owned, volume].sort((a, b) => a - b);
}
