// The Volumes tab's bar on each row: a series laid out as it stands on the
// shelf, in runs. Single volumes are one run; someone collecting an edition
// has its books first (Deluxe 1–14), then the volumes no book holds (vol.
// 43) as a second run. The bar (components/ownedBar/OwnedBar.tsx) draws a
// run as a pill, each book or volume as wide as the volumes it holds, so a
// gap shows as a break wherever it falls. Pure, so the server's Jest tests it.

// a book of the edition, or a single volume: the volumes it holds
export type BarSlot = { volumes: number[] };
export type BarRun = { books: boolean; slots: BarSlot[] };

export function barRuns(
  // the furthest volume out, or theirs if that's further
  total: number,
  // each of the edition's books out, by the volumes it holds; null when they
  // collect single volumes
  books: number[][] | null = null,
): BarRun[] {
  if (total < 1) return [];
  const inside = (books ?? [])
    .filter((volumes) => volumes.length && Math.min(...volumes) <= total)
    .map((volumes) => ({ volumes, book: true }));
  const inABook = new Set(inside.flatMap((s) => s.volumes));
  const singles = [];
  for (let volume = 1; volume <= total; volume++)
    if (!inABook.has(volume)) singles.push({ volumes: [volume], book: false });
  const first = (s: BarSlot) => Math.min(...s.volumes);
  const slots = [...inside, ...singles].sort((a, b) => first(a) - first(b));
  // a new run wherever books give way to singles, or singles to books
  const runs: BarRun[] = [];
  for (const { volumes, book } of slots) {
    const last = runs[runs.length - 1];
    if (last && last.books === book) last.slots.push({ volumes });
    else runs.push({ books: book, slots: [{ volumes }] });
  }
  return runs;
}

// how much of a book or volume is theirs, 0 to 1
export const shareOf = (slot: BarSlot, owned: Set<number>) =>
  slot.volumes.filter((v) => owned.has(v)).length / slot.volumes.length;
