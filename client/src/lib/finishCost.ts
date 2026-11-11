// What finishing a series costs: the volumes they don't own yet, added up at
// the prices already stored (a volume is priced the first time someone opens
// its page). Never asks for a price, so it never spends a paid search; a
// volume nobody has opened yet is counted as not priced.
import { owns } from "./ownedVolumes";
import type { Manga } from "./types";

// the volumes out that they don't own. A half volume or a vol. 0 special
// never counts as theirs, so it's always among these (as on the price page)
export const stillToGet = <T extends { volume: number }>(
  volumes: T[],
  owned: Pick<Manga, "volumesOwned"> & { ownedList?: number[] },
) =>
  volumes.filter(
    (v) =>
      !(v.volume >= 1 && Number.isInteger(v.volume) && owns(owned, v.volume)),
  );

export type FinishCost = {
  // the priced ones, added up
  cents: number;
  priced: number;
  // every volume still to get, priced or not
  left: number;
};

export function finishCost(
  toGet: { knownPriceCents: number | null; isbn13?: string }[],
): FinishCost | null {
  const priced = toGet.filter((v) => v.knownPriceCents != null);
  // nothing to add up: no line at all rather than a total of nothing
  if (!priced.length) return null;
  // two volumes in one book (the same ISBN) are bought, and paid for, once
  const once = new Map(
    priced.map((v, i) => [v.isbn13 ?? i, v.knownPriceCents!]),
  );
  return {
    cents: [...once.values()].reduce((sum, cents) => sum + cents, 0),
    priced: priced.length,
    left: toGet.length,
  };
}

// "Finish the series: $214", or with gaps "10 of 12 priced: $180 so far", so
// a partial total never reads as the whole cost. The price format comes in, so this stays free of the network code
export function finishText(cost: FinishCost, money: (cents: number) => string) {
  if (cost.priced === cost.left)
    return `Finish the series: ${money(cost.cents)}`;
  return `Finish the series: ${cost.priced} of ${cost.left} priced, ${money(cost.cents)} so far`;
}

export type SeriesCost = {
  // every volume out (a book holding two counts twice here, once in the money)
  volumes: number;
  // the priced ones, added up
  cents: number;
  priced: number;
  // all of them: the priced ones plus the rest at the priced ones' middle
  // price. Null with too few priced to go by
  estimateCents: number | null;
  // the middle price the rest are counted at
  usualCents: number | null;
  // every book priced: the total is exact, not an estimate
  complete: boolean;
};

// fewer priced than this and the middle price says too little to estimate by
const MIN_TO_ESTIMATE = 3;

// what buying a whole series new costs, at stored prices: for anyone
// weighing up a series before buying it. Null with nothing priced
export function seriesCost(
  volumes: { knownPriceCents: number | null; isbn13?: string }[],
): SeriesCost | null {
  // two volumes in one book are bought, and paid for, once
  const books = [
    ...new Map(volumes.map((v, i) => [v.isbn13 || i, v])).values(),
  ];
  const priced = books.flatMap((v) =>
    v.knownPriceCents != null ? [v.knownPriceCents] : [],
  );
  if (!priced.length) return null;
  const cents = priced.reduce((sum, c) => sum + c, 0);
  const sorted = [...priced].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const usual =
    sorted.length % 2
      ? sorted[mid]!
      : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  const unpriced = books.length - priced.length;
  return {
    volumes: volumes.length,
    cents,
    // counted in volumes, like `volumes`, for "8 of 113 priced"
    priced: volumes.filter((v) => v.knownPriceCents != null).length,
    estimateCents:
      unpriced === 0
        ? cents
        : priced.length >= MIN_TO_ESTIMATE
          ? cents + unpriced * usual
          : null,
    usualCents: usual,
    complete: unpriced === 0,
  };
}
