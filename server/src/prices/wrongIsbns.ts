// Finding a series list's wrong ISBNs without anyone's list
// (scripts/findWrongIsbns.ts). The catalogs sometimes give a volume an ISBN
// no store sells: mostly VIZ's ebook ISBNs, which they don't mark as ebooks.
// Such a book is found by how little it's sold, and its printed book by
// what sellers of that volume say its ISBN is:
//   1. suspect: no store has ever priced it, and eBay has at most
//      SUSPECT_MOST listings under the ISBN (a printed manga volume has
//      dozens; Tropical Fish 1's ebook ISBN had 2, its printed book 27)
//   2. its printed book: eBay's listings of "Series vol N" that our own
//      matching takes as that one volume (ebay.ts browseOffers, the rules a
//      price check uses), and the ISBN their sellers give on the listing's
//      page. Two listings must agree, the ISBN found must come from the
//      same publisher's block as the series' other volumes (not a stray
//      book, or an older printing numbered the same), and it must itself
//      have more listings than the suspect
// What's found is a trusted book of the lowest trust (1, "auto-ebay"): the
// series page takes it by the usual rules (trustedBooks.ts), and any list
// trusted more (a collector's, readers') wins over it. How often each step
// is right is measured against the collectors' lists first (--score).
import { browseOffers, type ItemSummary } from "./providers/ebay.js";
import { isCollection } from "./types.js";

export const AUTO_SOURCE = "auto-ebay";
export const AUTO_TRUST = 1;
// listings under an ISBN at or below which it looks like no printed book
export const SUSPECT_MOST = 2;
// listings of the volume whose ISBN is read, at most (each is a call):
// many sellers leave it blank, so a few more than two are read, stopping
// as soon as two agree
export const READ_MOST = 6;
// sellers who must give the same ISBN
export const AGREE = 2;

export const looksWrong = (listings: number) => listings <= SUSPECT_MOST;

// the listings, of a title search, that are this one volume by the rules a
// price check uses: no box sets, other volumes, editions or foreign books
export function listingsOfVolume(items: ItemSummary[], bookTitle: string) {
  return items.filter(
    (item) =>
      item.itemId &&
      browseOffers([item], bookTitle, "US", "title").some(
        (offer) => !isCollection(offer),
      ),
  );
}

// the ISBN most of the sellers give, when at least AGREE of them do and
// it isn't the suspect's own
export function agreedIsbn(found: (string | null)[], suspect: string) {
  const counts = new Map<string, number>();
  for (const isbn of found)
    if (isbn && isbn !== suspect) counts.set(isbn, (counts.get(isbn) ?? 0) + 1);
  const [best] = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return best && best[1] >= AGREE ? best[0] : null;
}

// the start of an ISBN that tells publishers apart (as trustedBooks.ts)
const blockOf = (isbn13: string) => isbn13.trim().slice(0, 7);

// whether a found ISBN is in the same publisher's block as one of the
// series' other volumes
export const sameHouse = (found: string, seriesIsbns: string[]) =>
  seriesIsbns.some((isbn) => blockOf(isbn) === blockOf(found));
