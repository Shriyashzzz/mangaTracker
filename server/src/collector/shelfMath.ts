// The shelf tools' arithmetic, kept apart from the database so it can be
// tested on its own: what a shelf is worth, what finishing each series costs,
// and what's coming out when. Everything reads prices already saved; nothing
// here asks a store or a catalog.
import type { CheapestCopy, RecordedPrice } from "../models/priceQueries.js";
import type { EditionLine } from "../prices/editionLines.js";

// a volume of a series as the saved lists know it
export type ListedVolume = {
  volume: number | null;
  isbn13: string;
  title: string;
  coverUrl?: string | null;
  // "2027-03-30" or "2027-03": still to come when after today
  published?: string | null;
};

// what someone owns of a series: "up to" N, or the exact list when it has gaps
// (util/shelf/ownedList.ts: an empty list means 1 to volumesOwned)
export type Owned = { volumesOwned: number | null; ownedList: number[] };

export const ownedSet = (m: Owned) =>
  new Set(
    m.ownedList.length
      ? m.ownedList
      : Array.from({ length: m.volumesOwned ?? 0 }, (_, i) => i + 1),
  );

export type Copies = { new: CheapestCopy | null; used: CheapestCopy | null };

// the day a volume comes out. A date given only to the month ("2027-03")
// counts as the month's last day: until the month is over it may still be
// coming, so it stays on the calendar rather than "out" on the 1st
export const releaseDay = (published?: string | null) => {
  if (!published) return null;
  const [y, m, d] = published.split("-").map(Number);
  if (!y || !m) return null;
  return d ? new Date(Date.UTC(y, m - 1, d)) : new Date(Date.UTC(y, m, 0));
};
export const isOut = (v: ListedVolume, now: Date) => {
  const day = releaseDay(v.published);
  return !day || day <= now;
};

// a whole-numbered volume from 1: a "10.5" special or a vol. 0 extra is never
// counted as missing (the price pages treat them the same way)
const isMainVolume = (
  v: ListedVolume,
): v is ListedVolume & { volume: number } =>
  v.volume !== null && v.volume >= 1 && Number.isInteger(v.volume);

// the middle of some prices (0 when there are none)
export const median = (cents: number[]) => {
  if (!cents.length) return 0;
  const sorted = [...cents].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};

// one book can hold several volumes (the same ISBN): it's bought, and worth
// something, once. A volume we know no book for (no ISBN) is its own
const onceEach = <T extends { isbn13: string; volume?: number | null }>(
  items: T[],
) => [
  ...new Map(items.map((i) => [i.isbn13 || `volume:${i.volume}`, i])).values(),
];

export const sum = (numbers: number[]) => {
  let total = 0;
  for (const n of numbers) total += n;
  return total;
};

// the place of the last item that passes the test, or -1
const lastIndexWhere = <T>(list: T[], passes: (item: T) => boolean) => {
  for (let i = list.length - 1; i >= 0; i--) if (passes(list[i]!)) return i;
  return -1;
};

// ---------- what the shelf is worth ----------

export type ShelfValue = {
  // the cheapest used copy of each owned volume we have a price for, added up
  cents: number;
  priced: number;
  // owned volumes we know the book of
  volumes: number;
  // owned volumes we know no book for: every one of a series with no saved
  // list, and any a series' list doesn't have (a special, a number no
  // catalog lists yet). Counted only in the estimate, at the shelf's usual
  // used price, so the estimate covers everything they own
  unlisted: number;
  // the priced ones plus an estimate for the rest: each at its series' usual
  // used price, or the shelf's when the series has none yet. Null when nothing
  // is priced to go by
  estimateCents: number | null;
};

// what the owned volumes would fetch used: each one's recorded used price
// (the median of every one seen, the last year's first: it never goes stale,
// see getRecordedMedians). A volume never seen used is estimated; `priced`
// says how many are real, so a part total never reads as the whole
export function shelfValue(
  series: { owned: Owned; volumes: ListedVolume[] }[],
  recorded: Map<string, Pick<RecordedPrice, "used">>,
  unlisted = 0,
): ShelfValue {
  const usedPrice = (book: ListedVolume) =>
    recorded.get(book.isbn13)?.used ?? undefined;
  // the used prices we have, for some books
  const knownPrices = (books: ListedVolume[]) => {
    const prices: number[] = [];
    for (const book of books) {
      const cents = usedPrice(book);
      if (cents !== undefined) prices.push(cents);
    }
    return prices;
  };

  // each series' owned books, in order. A book holding two volumes (one
  // ISBN) is counted once, across the whole shelf
  const counted = new Set<string>();
  // owned volumes their series' list has no book for
  let notInALists = 0;
  const booksBySeries = series.map(({ owned, volumes }) => {
    const mine = ownedSet(owned);
    const books: ListedVolume[] = [];
    const ownedAndListed = new Set<number>();
    for (const v of volumes) {
      if (!isMainVolume(v) || !mine.has(v.volume)) continue;
      ownedAndListed.add(v.volume);
      if (counted.has(v.isbn13)) continue;
      counted.add(v.isbn13);
      books.push(v);
    }
    notInALists += mine.size - ownedAndListed.size;
    return books;
  });
  const withoutABook = unlisted + notInALists;
  const allBooks = booksBySeries.flat();

  const prices = knownPrices(allBooks);
  const shelfUsual = median(prices);

  // the estimate: a priced book at its price, an unpriced one at its series'
  // usual price, or the shelf's when the series has no price at all
  let estimate = 0;
  for (const books of booksBySeries) {
    const seriesPrices = knownPrices(books);
    const seriesUsual = seriesPrices.length ? median(seriesPrices) : shelfUsual;
    for (const book of books) estimate += usedPrice(book) ?? seriesUsual;
  }
  estimate += withoutABook * shelfUsual;

  return {
    cents: sum(prices),
    priced: prices.length,
    volumes: allBooks.length,
    unlisted: withoutABook,
    estimateCents: prices.length ? estimate : null,
  };
}

// ---------- finishing each series ----------

export type MissingVolume = {
  volume: number;
  isbn13: string;
  title: string;
  // the cheapest new copy in stock, where we know one
  cheapest: CheapestCopy | null;
  // a book of the edition they collect: "Deluxe 3", and the volumes inside.
  // `volume` is then the book's number in that edition
  label?: string;
  inside?: number[];
};

type FinishSeries = {
  missing: MissingVolume[];
  // the priced ones added up (a book holding two missing volumes, once)
  cents: number;
  priced: number;
  // plus an estimate for the rest: each at the series' usual new price.
  // Null when too little of the series is priced to say (ENOUGH_PRICED)
  estimateCents: number | null;
};

// a total is said only when this much of a series has a price: with fewer,
// a volume or two would stand in for the whole run (the price pages hold to
// the same share: client/src/lib/finishCost.ts ENOUGH_PRICED)
export const ENOUGH_PRICED = 0.6;
const enoughPriced = (priced: number, all: number) =>
  all > 0 && priced >= all * ENOUGH_PRICED;

type NewPrices = Map<string, Pick<RecordedPrice, "new">>;

// the newest whole volume that's out. A number the saved list skipped still
// counts when a later one is out. And every number below one known to be
// coming is out too (vol. 22 due: 19 to 21 are out even if the list never
// had them)
function newestVolumeOut(
  listed: (ListedVolume & { volume: number })[],
  now: Date,
) {
  let newest = 0;
  let firstComing: number | null = null;
  for (const v of listed) {
    if (isOut(v, now)) newest = Math.max(newest, v.volume);
    else if (firstComing === null || v.volume < firstComing)
      firstComing = v.volume;
  }
  if (firstComing !== null)
    newest = Math.max(newest, Math.ceil(firstComing) - 1);
  return newest;
}

// the volumes out now that they don't own, each with its cheapest new copy.
// One the list never had is still missing, just with no book to price (no
// ISBN: it's checked on the series page)
function missingVolumes(
  mine: Set<number>,
  volumes: ListedVolume[],
  copies: Map<string, Copies>,
  now: Date,
) {
  const listed = volumes.filter(isMainVolume);
  const byNumber = new Map(listed.map((v) => [v.volume, v]));
  const cheapestNew = (isbn13: string) => copies.get(isbn13)?.new ?? null;

  const missing: MissingVolume[] = [];
  // a vol. 0 the list has (Jujutsu Kaisen 0) is part of the run too, unless
  // their list names it: the price pages count it the same way
  const zero = volumes.find((v) => v.volume === 0);
  if (zero && isOut(zero, now) && !mine.has(0))
    missing.push({
      volume: 0,
      isbn13: zero.isbn13,
      title: zero.title,
      cheapest: cheapestNew(zero.isbn13),
    });

  const newest = newestVolumeOut(listed, now);
  for (let number = 1; number <= newest; number++) {
    if (mine.has(number)) continue;
    const listedVolume = byNumber.get(number);
    // known to be coming, not out: the calendar's, not missing
    if (listedVolume && !isOut(listedVolume, now)) continue;
    missing.push({
      volume: number,
      isbn13: listedVolume?.isbn13 ?? "",
      title: listedVolume?.title ?? "",
      cheapest: listedVolume ? cheapestNew(listedVolume.isbn13) : null,
    });
  }
  return missing;
}

// what finishing comes to, from the missing books and a price for each
// unpriced one. No estimate when too little is priced to say (`enough`), or
// when an unpriced book has nothing at all to go by
function finishTotal(
  missing: MissingVolume[],
  // one book once, where two missing volumes share an ISBN
  pricedBooks: MissingVolume[],
  unpricedGuesses: number[],
  enough: boolean,
): FinishSeries {
  const cents = sum(pricedBooks.map((m) => m.cheapest!.cents));
  const everyGuessIsAPrice = unpricedGuesses.every((guess) => guess > 0);
  const canEstimate = enough && (everyGuessIsAPrice || pricedBooks.length > 0);
  return {
    missing,
    cents,
    priced: missing.filter((m) => m.cheapest).length,
    estimateCents: canEstimate ? cents + sum(unpricedGuesses) : null,
  };
}

// the volumes out now that they don't own, and what buying them comes to.
// Ones not out yet are the calendar's, not missing
export function finishSeries(
  owned: Owned,
  volumes: ListedVolume[],
  copies: Map<string, Copies>,
  now = new Date(),
  fallbackCents = 0,
  // each volume's recorded new price: an unpriced one's own beats the
  // series' usual (see getRecordedMedians)
  recorded: NewPrices = new Map(),
): FinishSeries {
  const missing = missingVolumes(ownedSet(owned), volumes, copies, now);
  const recordedNew = (isbn13: string) =>
    recorded.get(isbn13)?.new ?? undefined;
  const newToday = (isbn13: string) => copies.get(isbn13)?.new;

  // the series' usual new price, from any of its volumes priced (owned too):
  // what they've gone for, or failing that what they cost now
  const seriesPrices: number[] = [];
  for (const v of volumes) {
    const cents = recordedNew(v.isbn13) ?? newToday(v.isbn13)?.cents;
    if (cents !== undefined) seriesPrices.push(cents);
  }
  const usual = seriesPrices.length ? median(seriesPrices) : fallbackCents;

  // each unpriced one at its own recorded price, else the series' usual
  const unpricedBooks = onceEach(missing.filter((m) => !m.cheapest));
  const unpricedGuesses = unpricedBooks.map(
    (m) => (m.isbn13 && recordedNew(m.isbn13)) || usual,
  );

  // of every book out, the ones with a price today or one ever recorded
  const booksOut = onceEach(
    volumes.filter(isMainVolume).filter((v) => isOut(v, now)),
  );
  const booksWithAPrice = booksOut.filter(
    (v) => newToday(v.isbn13) || recordedNew(v.isbn13) !== undefined,
  );

  return finishTotal(
    missing,
    onceEach(missing.filter((m) => m.cheapest)),
    unpricedGuesses,
    enoughPriced(booksWithAPrice.length, booksOut.length),
  );
}

// the same for someone collecting an edition (prices/editionLines.ts): the
// books of that line they don't have all of, each once. A book past the last
// one the catalog lists isn't counted: it may not be out. One with no price
// is estimated at the line's usual price, or `fallbackCents` (a single
// volume's) for each volume it holds
export function finishEdition(
  owned: Owned,
  line: EditionLine,
  copies: Map<string, Copies>,
  fallbackCents = 0,
  recorded: NewPrices = new Map(),
): FinishSeries {
  const mine = ownedSet(owned);
  const lastListed = lastIndexWhere(line.books, (book) => book.listed);
  const booksOut = line.books.slice(0, lastListed + 1);
  const newToday = (isbn13: string | null) =>
    isbn13 ? (copies.get(isbn13)?.new ?? null) : null;
  const recordedNew = (isbn13: string | null) =>
    isbn13 ? recorded.get(isbn13)?.new : undefined;

  const missing: MissingVolume[] = [];
  for (const book of booksOut) {
    const ownsAllOfIt = book.volumes.every((v) => mine.has(v));
    if (ownsAllOfIt) continue;
    const label = `${line.label} ${book.number}`;
    missing.push({
      volume: book.number,
      isbn13: book.isbn13 ?? "",
      title: book.title ?? label,
      cheapest: newToday(book.isbn13),
      label,
      inside: book.volumes,
    });
  }

  // the line's usual price, from any of its books priced (owned too)
  const linePrices: number[] = [];
  for (const book of booksOut) {
    const cents = recordedNew(book.isbn13) || newToday(book.isbn13)?.cents;
    if (cents) linePrices.push(cents);
  }
  const usual = linePrices.length ? median(linePrices) : 0;

  // each unpriced book at its own recorded price, else the line's usual,
  // else a single volume's price for each volume inside
  const unpricedGuesses = missing
    .filter((m) => !m.cheapest)
    .map(
      (m) =>
        recordedNew(m.isbn13 || null) ||
        usual ||
        fallbackCents * (m.inside?.length ?? 1),
    );

  return finishTotal(
    missing,
    missing.filter((m) => m.cheapest),
    unpricedGuesses,
    enoughPriced(linePrices.length, booksOut.length),
  );
}

type RecordedBook = { edition: string; volumes: number[] };

// how many of their volumes sit in books that are this line's own: a recorded
// "Deluxe" book holding 4–6 matches a deluxe line with a book holding 4–6. A
// deluxe book never points to an omnibus line of the same size
function volumesInLine(line: EditionLine, recorded: RecordedBook[]) {
  const lineBooks = new Set(line.books.map((book) => book.volumes.join()));
  let volumes = 0;
  for (const book of recorded) {
    const sameKind = book.edition === line.kind;
    if (sameKind && lineBooks.has(book.volumes.join()))
      volumes += book.volumes.length;
  }
  return volumes;
}

// the line a reader seems to collect, from the books they've recorded: the
// one whose books match theirs, when those cover at least half of what they
// own. The same rule as the details page's (client/src/lib/editions.ts
// guessEdition and its volumesInLine), so the two agree
export function guessedLine(
  lines: EditionLine[],
  books: RecordedBook[],
  ownedCount: number,
): EditionLine | null {
  if (!lines.length || !ownedCount) return null;
  let best: EditionLine | null = null;
  let bestVolumes = 0;
  for (const line of lines) {
    const volumes = volumesInLine(line, books);
    if (volumes > bestVolumes) {
      best = line;
      bestVolumes = volumes;
    }
  }
  const atLeastHalf = bestVolumes * 2 >= ownedCount;
  return atLeastHalf ? best : null;
}

// ---------- coming out ----------

export type Upcoming = {
  volume: number | null;
  isbn13: string;
  title: string;
  coverUrl: string | null;
  // as the catalog gave it: a day, or only a month
  published: string;
  // "2027-03"
  month: string;
};

// volumes still to come in the next `months` months, soonest first. A date
// given only to the month sorts at its start
export function upcoming(
  volumes: ListedVolume[],
  now = new Date(),
  months = 12,
): Upcoming[] {
  const until = new Date(now);
  until.setUTCMonth(until.getUTCMonth() + months);

  const coming: Upcoming[] = [];
  for (const v of volumes) {
    const day = releaseDay(v.published);
    const inWindow = day !== null && day > now && day <= until;
    if (!inWindow) continue;
    coming.push({
      volume: v.volume,
      isbn13: v.isbn13,
      title: v.title,
      coverUrl: v.coverUrl ?? null,
      published: v.published!,
      month: v.published!.slice(0, 7),
    });
  }
  const dayOf = (u: Upcoming) => releaseDay(u.published)!.getTime();
  return onceEach(coming).sort((a, b) => dayOf(a) - dayOf(b));
}
