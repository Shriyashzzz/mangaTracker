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

type FinishCost = {
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

// most of a series priced before its total is said. The same share as the
// server's (server/src/collector/shelfMath.ts ENOUGH_PRICED): change both
// together
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
const hasPrice = (v: Priced) => priceOf(v) != null;

const sum = (numbers: number[]) => {
  let total = 0;
  for (const n of numbers) total += n;
  return total;
};

// the middle of some prices (null when there are none)
function median(prices: number[]) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const isOdd = sorted.length % 2 === 1;
  return isOdd
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

// each book once: two volumes in one book (the same ISBN) are bought, and
// paid for, once. A volume with no ISBN is its own book. Where two share an
// ISBN the later one is kept, in the first one's place
function oneOfEachBook<T extends { isbn13?: string }>(volumes: T[]) {
  const byBook = new Map<string | number, T>();
  volumes.forEach((v, index) => byBook.set(v.isbn13 || index, v));
  return [...byBook.values()];
}

// the prices we have, for some volumes
function pricesOf(volumes: Priced[]) {
  const prices: number[] = [];
  for (const v of volumes) {
    const cents = priceOf(v);
    if (cents != null) prices.push(cents);
  }
  return prices;
}

// `series`: every volume of it, for the usual price the unpriced ones are
// counted at; without it, the priced ones still to get
export function finishCost(
  toGet: Priced[],
  series: Priced[] = toGet,
): FinishCost | null {
  if (!toGet.length) return null;
  const usual = median(pricesOf(series)) ?? median(pricesOf(toGet));
  // nothing priced anywhere in the series: no line rather than a guess
  if (usual == null) return null;

  const booksToGet = oneOfEachBook(toGet);
  const cents = sum(pricesOf(booksToGet));
  const unpricedBooks = booksToGet.filter((v) => !hasPrice(v)).length;

  // of the whole series, each book once: is enough of it priced to say?
  const allBooks = oneOfEachBook(series);
  const pricedBooks = allBooks.filter(hasPrice).length;
  return {
    cents,
    priced: toGet.filter(hasPrice).length,
    left: toGet.length,
    estimateCents: cents + unpricedBooks * usual,
    enough: pricedBooks >= allBooks.length * ENOUGH_PRICED,
  };
}

// the money to show: exact when every one is priced, otherwise the estimate
// to the nearest ten dollars (cents would claim a precision it lacks)
export function finishMoney(
  cost: FinishCost,
  money: (cents: number) => string,
) {
  if (!cost.enough) return "check prices";
  if (cost.priced === cost.left) return money(cost.cents);
  const nearestTen = Math.round(cost.estimateCents / 1000) * 10;
  return "about $" + nearestTen.toLocaleString("en-US");
}

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

// what buying a whole series new costs, at stored prices: for anyone
// weighing up a series before buying it. Null with nothing priced. One priced
// volume is enough to estimate by: an estimate, said as one, beats a total of
// one volume
export function seriesCost(
  volumes: { knownPriceCents: number | null; isbn13?: string }[],
): SeriesCost | null {
  const books = oneOfEachBook(volumes);
  const prices: number[] = [];
  for (const book of books)
    if (book.knownPriceCents != null) prices.push(book.knownPriceCents);
  const usual = median(prices);
  if (usual === null) return null;

  const cents = sum(prices);
  const unpricedBooks = books.length - prices.length;
  return {
    volumes: volumes.length,
    cents,
    // counted in volumes, like `volumes`, for "8 of 113 priced"
    priced: volumes.filter((v) => v.knownPriceCents != null).length,
    estimateCents: cents + unpricedBooks * usual,
    usualCents: usual,
    complete: unpricedBooks === 0,
  };
}
