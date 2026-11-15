// What a Select's undo sends back to the server after a delete, and in what
// pieces. Pure, so the server's tests can load it.
import { dayOf } from "./books";
import type { Manga } from "./types";

// what the undo needs of a series, and nothing else (ids, dates, prices)
export const restorable = (m: Manga) => ({
  // within the limits restore checks, which older rows may be past
  name: m.name.slice(0, 150),
  status: m.status,
  planned: m.planned,
  lightNovel: m.lightNovel,
  bookmark: m.bookmark,
  byVolume: m.byVolume,
  readVolume: m.readVolume,
  edition: m.edition,
  volumesOwned: m.volumesOwned,
  ownedList: m.ownedList,
  genre: m.genre,
  description: m.description?.slice(0, 450) ?? null,
  image: m.image,
  rating: m.rating,
  seenVolume: m.seenVolume,
  seenChapter: m.seenChapter,
  seenJapanVolume: m.seenJapanVolume,
  hiddenVolumes: m.hiddenVolumes,
  latestChapter: m.latestChapter,
  // the books behind its volumes, without their old ids
  books: m.books?.map((b) => ({
    isbn13: b.isbn13,
    edition: b.edition,
    number: b.number,
    title: b.title,
    volumes: b.volumes,
    paidCents: b.paidCents ?? null,
    boughtOn: dayOf(b.boughtOn),
  })),
});

// A Select's undo sends the series back in pieces the server takes: it
// reads at most 512 KB a request (server app.ts), and a series with its
// books and ISBNs can be several KB, so 200 of them were too many and the
// undo failed every time. At most this many series, and this many bytes
const RESTORE_PIECE = 200;
const RESTORE_BYTES = 300_000;
const sizeOf = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;
// the series as the undo sends them, split into pieces under both limits
export function restorePieces(series: Manga[]) {
  const pieces: Manga[][] = [];
  let piece: Manga[] = [];
  let bytes = 0;
  for (const m of series) {
    const size = sizeOf(restorable(m));
    if (
      piece.length &&
      (piece.length >= RESTORE_PIECE || bytes + size > RESTORE_BYTES)
    ) {
      pieces.push(piece);
      piece = [];
      bytes = 0;
    }
    piece.push(m);
    bytes += size;
  }
  if (piece.length) pieces.push(piece);
  return pieces;
}
