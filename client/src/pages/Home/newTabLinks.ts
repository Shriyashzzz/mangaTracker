// Where a card on the New tab leads, and what its cover is stamped with.
// Worked out from what the release check found for the series; pure, no state.
import { volumePath } from "../../lib/prices";
import type { ReleaseStatus } from "../../lib/types";
import { isGrouped, type ReleaseKind } from "./shelfViews";

type Found = ReleaseStatus | null | undefined;

// a card on New opens its details at the part about this kind of release
export function detailsSearchFor(kind: ReleaseKind) {
  if (kind === "japan") return "?edition=japan";
  if (kind === "chapters") return "?new=chapter";
  return undefined;
}

// the next English volume leads straight to its prices: there's nothing to do
// with it but buy it. Undefined (so the details page, as usual) when there's
// no catalog entry to go on, or the series has several out at once
export function buyLinkFor(found: Found, kind: ReleaseKind) {
  const book = found?.nextVolumeBook;
  if (kind !== "volumes" || !book || isGrouped(found, kind)) return undefined;
  return volumePath(book.isbn13, book.title);
}

// which release a pile's cover is about: "Vol. 5", "Ch. 120"
export function stampFor(found: Found, kind: ReleaseKind) {
  if (kind === "chapters")
    return `Ch. ${found?.nextChapter ?? found?.latestChapter ?? ""}`;
  if (kind === "japan")
    return `Vol. ${found?.outJapanVolumes[0] ?? found?.latestJapaneseVolume ?? ""}`;
  return `Vol. ${found?.nextVolume ?? found?.latestVolume ?? ""}`;
}
