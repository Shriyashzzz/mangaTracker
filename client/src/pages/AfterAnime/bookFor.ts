// Which book of a series' English list is volume N, for the "after the
// anime" pages.
import type { SeriesVolume } from "../../lib/types";

// the book for a volume number: one sold on its own, with a price when
// there's a choice
export function bookFor(volumes: SeriesVolume[], number: number) {
  const matches = volumes.filter((v) => v.volume === number && !v.inBook);
  return matches.find((v) => v.knownPriceCents !== null) ?? matches[0] ?? null;
}
