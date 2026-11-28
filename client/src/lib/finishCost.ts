// What finishing a series costs: the volumes they don't own yet, added up at
// the prices already stored (a volume is priced the first time someone opens
// its page). Never asks for a price, so it never spends a paid search; a
// volume nobody has opened yet is counted as not priced.
import { wholeMoney } from "./country";
import { PRICE_FRESH_DAYS } from "./priceAge";
import { enoughPriced } from "./enoughPriced";
import { owns } from "./ownedVolumes";
import type { Manga } from "./types";

// the volumes out that they don't own. A half volume or a vol. 0 is theirs
// only when their list names it ("up to vol. 14" says nothing of a 0)
export const stillToGet = <T extends { volume: number }>(
  volumes: T[],
  owned: Pick<Manga, "volumesOwned"> & { ownedList?: number[] },
) => volumes.filter((v) => !owns(owned, v.volume));

type FinishCost = {
  // the priced ones, added up
  cents: number;
  priced: number;
  // every volume still to get, priced or not
  left: number;
  // all of them: the priced ones plus the rest at the series' usual new
  // price (the middle of every priced volume, owned ones too)
  estimateCents: number;
};

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
  return {
    cents,
    priced: toGet.filter(hasPrice).length,
    left: toGet.length,
    estimateCents: cents + unpricedBooks * usual,
  };
}

// the money to show: exact when every one is priced, otherwise the estimate
// to the nearest ten dollars (cents would claim a precision it lacks)
export function finishMoney(
  cost: FinishCost,
  money: (cents: number) => string,
) {
  if (cost.priced === cost.left) return money(cost.cents);
  const nearestTen = Math.round(cost.estimateCents / 1000) * 10;
  return "about " + wholeMoney(nearestTen * 100);
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

// what a run costs, as the pages say it: to the cent when every book is
// priced, else an estimate to the nearest $10 ("About $480"), since cents
// would claim a precision it lacks. Null with nothing priced at all
// (SeriesCostBox's "Collect every volume", OtherEditions' line beside it)
export function runTotal(cost: SeriesCost | null) {
  if (!cost || cost.estimateCents == null) return null;
  return cost.complete
    ? { cents: cost.estimateCents, exact: true }
    : { cents: Math.round(cost.estimateCents / 1000) * 1000, exact: false };
}

// the used copies found for a series, added up, and what all of it would
// come to used: the ones with no copy on sale at the middle of those found.
// Null when fewer than half the books have one
export function usedCopies(
  volumes: { usedCents?: number | null; isbn13?: string }[],
) {
  const books = oneOfEachBook(volumes);
  const prices: number[] = [];
  // a book holding two volumes is one copy to buy
  for (const book of books)
    if (book.usedCents != null) prices.push(book.usedCents);
  const usual = median(prices);
  // too few on sale used to say what all of it comes to (lib/enoughPriced.ts)
  if (usual === null || !enoughPriced(prices.length, books.length)) return null;
  const cents = sum(prices);
  const unpricedBooks = books.length - prices.length;
  return {
    // counted in volumes, like the box's own "all 30"
    volumes: volumes.filter((volume) => volume.usedCents != null).length,
    cents,
    estimateCents: cents + unpricedBooks * usual,
    // every book has a used copy on sale: the total is exact
    complete: unpricedBooks === 0,
  };
}

// what buying a whole series new costs, at stored prices: for anyone
// weighing up a series before buying it. Null with nothing priced; else an
// estimate of all of it, the unpriced at the priced ones' middle price, once
// at least half the books are priced (estimateCents null before that)
// a price checked over a week ago still shows, with its age, but a total
// counting one is "About", not exact (the server's models/priceAge.ts)
const WEEK_MS = PRICE_FRESH_DAYS * 24 * 60 * 60 * 1000;
const isFresh = (checkedAt: string | null | undefined, now: number) =>
  !checkedAt || now - new Date(checkedAt).getTime() <= WEEK_MS;

export function seriesCost(
  volumes: {
    knownPriceCents: number | null;
    knownCheckedAt?: string | null;
    isbn13?: string;
  }[],
  now = Date.now(),
): SeriesCost | null {
  const books = oneOfEachBook(volumes);
  const prices: number[] = [];
  let anyOld = false;
  for (const book of books)
    if (book.knownPriceCents != null) {
      prices.push(book.knownPriceCents);
      if (!isFresh(book.knownCheckedAt, now)) anyOld = true;
    }
  const usual = median(prices);
  if (usual === null) return null;

  const cents = sum(prices);
  const unpricedBooks = books.length - prices.length;
  return {
    volumes: volumes.length,
    cents,
    // counted in volumes, like `volumes`, for "8 of 113 priced"
    priced: volumes.filter((v) => v.knownPriceCents != null).length,
    // too few priced for a total worth saying (lib/enoughPriced.ts)
    estimateCents: enoughPriced(prices.length, books.length)
      ? cents + unpricedBooks * usual
      : null,
    usualCents: usual,
    // every one priced, and every price under a week old
    complete: unpricedBooks === 0 && !anyOld,
  };
}
