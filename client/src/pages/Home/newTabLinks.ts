// Where a card on the New tab leads, and what its cover is stamped with.
// Worked out from what the release check found for the series; pure, no state.
import { volumePath } from "../../lib/pricePaths";
import {
  knowsNextVolume,
  nextVolumeName,
  nextVolumeNumber,
} from "../../lib/releaseMath";
import type { ReleaseStatus } from "../../lib/types";
import type { ReleaseKind } from "./shelfViews";

type Found = ReleaseStatus | null | undefined;

// a card on New opens its details at the part about this kind of release:
// the Japanese edition for a volume out in Japan. Other news is on the page
// as it opens
export function detailsSearchFor(kind: ReleaseKind) {
  if (kind === "japan") return "?edition=japan";
  return undefined;
}

// the next English volume leads straight to its prices: there's nothing to do
// with it but buy it. Undefined (so the details page, as usual) when there's
// no catalog entry to go on. (A card that opens the list of what's out does
// that first: MangaCard's onOpen comes before its link)
export function buyLinkFor(found: Found, kind: ReleaseKind) {
  // collected as an edition: its next book's own price page ("Definitive
  // 3"), never the next single volume's. No ISBN for it: the series' page
  const edition = found?.editionBooks;
  if (kind === "volumes" && edition) {
    if (!edition.isbn13) return undefined;
    const name = edition.title ?? `${edition.label} ${edition.next}`;
    return volumePath(edition.isbn13, name);
  }
  // only when the catalog's next book is theirs: with a hole there, the
  // details page (it has no book for the one they need)
  const book = knowsNextVolume(found) ? found?.nextVolumeBook : null;
  if (kind !== "volumes" || !book) return undefined;
  return volumePath(book.isbn13, book.title);
}

// which release a pile's cover is about: "Vol. 5", "Ch. 120"
export function stampFor(found: Found, kind: ReleaseKind) {
  if (kind === "chapters")
    return `Ch. ${found?.nextChapter ?? found?.latestChapter ?? ""}`;
  if (kind === "japan")
    return `Vol. ${found?.outJapanVolumes[0] ?? found?.latestJapaneseVolume ?? ""}`;
  // an edition's book: "Book 3", never a cut name like "Def. 3" (the card's
  // words say which edition, in full)
  if (found?.editionBooks) return `Book ${found.editionBooks.next}`;
  // no stamp when we can't say which volume is next
  if (found && nextVolumeNumber(found) == null) return "";
  return nextVolumeName(found);
}
