// What finishing a series costs: the volumes they don't own yet, added up at
// the prices already stored (a volume is priced the first time someone opens
// its page). Never asks for a price, so it never spends a paid search; a
// volume nobody has opened yet is counted as not priced.
import { owns } from "./ownedVolumes";
import type { Manga } from "./types";

// the volumes out that they don't own. A half volume or a vol. 0 is theirs
// only when their list names it ("up to vol. 14" says nothing of a 0)
export const stillToGet = <T extends { volume: number }>(
  volumes: T[],
  owned: Pick<Manga, "volumesOwned"> & { ownedList?: number[] },
) => volumes.filter((v) => !owns(owned, v.volume));

// those, and the whole volumes below the newest that no catalog lists yet
// and they don't own: out all the same, just with no book to price. So "to
// finish" counts what the shelf's own tools count (server finishSeries)
export function leftToGet<
  T extends { volume: number; isbn13: string; knownPriceCents: number | null },
>(
  out: T[],
  owned: Pick<Manga, "volumesOwned"> & { ownedList?: number[] },
): (T | { volume: number; isbn13: string; knownPriceCents: null })[] {
  const listed = new Set(out.map((v) => v.volume));
  const newest = Math.max(
    0,
    ...out.map((v) => v.volume).filter(Number.isInteger),
  );
  const unlisted = Array.from({ length: newest }, (_, i) => i + 1)
    .filter((n) => !listed.has(n) && !owns(owned, n))
    .map((n) => ({ volume: n, isbn13: "", knownPriceCents: null }));
  return [...stillToGet(out, owned), ...unlisted].sort(
    (a, b) => a.volume - b.volume,
  );
}

export type FinishCost = {
  // the priced ones, added up
  cents: number;
  priced: number;
  // every volume still to get, priced or not
  left: number;
  // all of them: the priced ones plus the rest at the series' usual new
  // price (the middle of every priced volume, owned ones too)
  estimateCents: number;
  // enough of the series is priced to say a total: with fewer, a few
  // volumes' prices would stand in for the whole run
  enough: boolean;
};

// most of a series priced before its total is said
export const ENOUGH_PRICED = 0.6;

type Priced = {
  knownPriceCents: number | null;
  // what it has usually sold for new, from every price ever recorded: it
  // stands in when no store has it right now, so an estimate never goes
  // stale for want of a fresh check
  recordedCents?: number | null;
  isbn13?: string;
};
// a volume's price for the estimate: today's, else what it has gone for
const priceOf = (v: Priced) => v.knownPriceCents ?? v.recordedCents ?? null;

// the middle price of some volumes (null when none is priced)
const usualOf = (volumes: Priced[]) => {
  const cents = volumes.flatMap((v) => priceOf(v) ?? []).sort((a, b) => a - b);
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
  const cents = books.reduce((sum, v) => sum + (priceOf(v) ?? 0), 0);
  const unpriced = books.filter((v) => priceOf(v) == null).length;
  // of the whole series, each book once
  const all = [...new Map(series.map((v, i) => [v.isbn13 || i, v])).values()];
  return {
    cents,
    priced: toGet.filter((v) => priceOf(v) != null).length,
    left: toGet.length,
    estimateCents: cents + unpriced * usual,
    enough:
      all.filter((v) => priceOf(v) != null).length >=
      all.length * ENOUGH_PRICED,
  };
}

// the money to show: exact when every one is priced, otherwise the estimate
// to the nearest $10 (cents would claim a precision it lacks)
export const finishMoney = (
  cost: FinishCost,
  money: (cents: number) => string,
) =>
  !cost.enough
    ? "check prices"
    : cost.priced === cost.left
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
