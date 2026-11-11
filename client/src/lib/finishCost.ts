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
  // all of them: the priced ones plus the rest at the series' usual new
  // price (the middle of every priced volume, owned ones too)
  estimateCents: number;
};

type Priced = { knownPriceCents: number | null; isbn13?: string };

// the middle price of some volumes (null when none is priced)
const usualOf = (volumes: Priced[]) => {
  const cents = volumes
    .flatMap((v) => (v.knownPriceCents != null ? [v.knownPriceCents] : []))
    .sort((a, b) => a - b);
  if (!cents.length) return null;
  const mid = Math.floor(cents.length / 2);
  return cents.length % 2
    ? cents[mid]!
    : Math.round((cents[mid - 1]! + cents[mid]!) / 2);
};

// `series`: every volume of it, for the usual price the unpriced ones are
// counted at; without it, the priced ones still to get
export function finishCost(
  toGet: Priced[],
  series: Priced[] = toGet,
): FinishCost | null {
  if (!toGet.length) return null;
  const usual = usualOf(series) ?? usualOf(toGet);
  // nothing priced anywhere in the series: no line rather than a guess
  if (usual == null) return null;
  // two volumes in one book (the same ISBN) are bought, and paid for, once
  const books = [...new Map(toGet.map((v, i) => [v.isbn13 || i, v])).values()];
  const cents = books.reduce((sum, v) => sum + (v.knownPriceCents ?? 0), 0);
  const unpriced = books.filter((v) => v.knownPriceCents == null).length;
  return {
    cents,
    priced: toGet.filter((v) => v.knownPriceCents != null).length,
    left: toGet.length,
    estimateCents: cents + unpriced * usual,
  };
}

// the money to show: exact when every one is priced, otherwise the estimate
// to the nearest $10 (cents would claim a precision it lacks)
export const finishMoney = (
  cost: FinishCost,
  money: (cents: number) => string,
) =>
  cost.priced === cost.left
    ? money(cost.cents)
    : `about $${(Math.round(cost.estimateCents / 1000) * 10).toLocaleString("en-US")}`;

// "Finish the series: $214", or with volumes not priced yet "Finish the
// series: about $250". The price format comes in, so this stays free of the
// network code
export function finishText(cost: FinishCost, money: (cents: number) => string) {
  return `Finish the series: ${finishMoney(cost, money)}`;
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

// one priced is enough to estimate by: an estimate, said as one, beats a
// total of one volume
const MIN_TO_ESTIMATE = 1;

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
