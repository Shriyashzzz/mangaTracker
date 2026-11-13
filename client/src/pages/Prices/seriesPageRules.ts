// What a series' price page works out from its list of volumes: how they're
// grouped into cards, what each card says, and which numbers are missing from
// the catalog. Pure: no requests and no state.
import { owns } from "../../lib/ownedVolumes";
import { notOutYet } from "../../lib/releaseDate";
import type { SeriesVolume, ShelfMatch } from "../../lib/types";

// how many volumes a page of the list shows
export const PAGE_SIZE = 30;

// "Preorder · out Mar 30, 2027" for a volume not out yet, else nothing. A
// date given only to the month says the month
function preorderText(published?: string) {
  if (!published || !notOutYet(published)) return null;
  const [year, month, day] = published.split("-").map(Number);
  const out = new Date(year!, month! - 1, day || 1);
  const when = out.toLocaleDateString("en-US", {
    month: "short",
    ...(day ? { day: "numeric" } : {}),
    year: "numeric",
  });
  return `Preorder · out ${when}`;
}

// the volumes of one card: one, or the several that one book holds
export type Card = SeriesVolume[];

// the series' volumes as cards: one each, except that the volumes of one book
// holding several (same ISBN, side by side) share a card. The shelf and its
// data still count each volume on its own
export function cardsOf(volumes: SeriesVolume[]) {
  const cards: Card[] = [];
  for (const volume of volumes) {
    const last = cards[cards.length - 1];
    const sameBookAsLast =
      volume.inBook && last?.[0]?.inBook && last[0].isbn13 === volume.isbn13;
    if (sameBookAsLast) last!.push(volume);
    else cards.push([volume]);
  }
  return cards;
}

// the last words under a card: its preorder date, or "See price" when we
// have no price for it yet (opening it looks its prices up)
function priceNote(volume: SeriesVolume) {
  return (
    preorderText(volume.published) ??
    (volume.knownPriceCents == null && "See price")
  );
}

// under a card holding one volume. A book's volume shown alone (the rest on
// another page, or on their shelf) still says it comes in that book
export function oneVolumeSubtitle(volume: SeriesVolume) {
  const inBook =
    volume.inBook &&
    `In Book ${volume.inBook.book} (vols ${volume.inBook.from}–${volume.inBook.to})`;
  const parts = [inBook, priceNote(volume)].filter(Boolean);
  return parts.join(" · ") || undefined;
}

// under a card for one book holding several volumes
export function bookSubtitle(card: Card) {
  const volumes = card.map((v) => v.volume).join(" & ");
  const parts = [`Vols. ${volumes} in one book`, priceNote(card[0]!)];
  return parts.filter(Boolean).join(" · ");
}

// a card's mark for someone with the series on their shelf: "yours" when
// every volume on it is theirs, "next" when it holds the next one they need
export function markOf(
  card: Card,
  mine: ShelfMatch,
  // the next volume they need; undefined when there's none
  next: number | undefined,
) {
  const isTheirs = (volume: number) =>
    Boolean(mine) &&
    volume >= 1 &&
    Number.isInteger(volume) &&
    owns(mine!, volume);
  if (card.every((v) => isTheirs(v.volume))) return "yours" as const;
  if (card.some((v) => v.volume === next)) return "next" as const;
  return undefined;
}

// whole volumes below the newest that no catalog lists yet (they're looked
// up a few a day): said on the page, so the list and its cost never pass for
// complete
export function unlistedNumbers(volumes: SeriesVolume[]) {
  const listed = new Set(volumes.map((v) => v.volume));
  const newestListed = Math.max(0, ...volumes.map((v) => v.volume));
  const unlisted: number[] = [];
  for (let number = 1; number <= newestListed; number++)
    if (!listed.has(number)) unlisted.push(number);
  return unlisted;
}

// the volumes on one page of the list, by volume number (so gaps in the
// catalog don't skew the pages). The first page takes vol. 0 and below too
export function volumesOnPage(volumes: SeriesVolume[], pageIndex: number) {
  const first = pageIndex * PAGE_SIZE + 1;
  const last = first + PAGE_SIZE - 1;
  return volumes.filter((v) => {
    const isBeforeTheFirst = pageIndex === 0 && v.volume < 1;
    return (v.volume >= first || isBeforeTheFirst) && v.volume <= last;
  });
}
