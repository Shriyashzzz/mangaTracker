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

// ---------- what the shelf is worth ----------

export type ShelfValue = {
  // the cheapest used copy of each owned volume we have a price for, added up
  cents: number;
  priced: number;
  // owned volumes we know the book of
  volumes: number;
  // owned volumes of series with no saved list: counted only in the estimate,
  // at the shelf's usual used price
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
  const usedOf = (v: ListedVolume) => recorded.get(v.isbn13)?.used ?? undefined;
  const seen = new Set<string>();
  // each series' owned books (a book holding two volumes, once), in order
  const perSeries = series.map(({ owned, volumes }) => {
    const mine = ownedSet(owned);
    return volumes.filter((v) => {
      if (!isMainVolume(v) || !mine.has(v.volume) || seen.has(v.isbn13))
        return false;
      seen.add(v.isbn13);
      return true;
    });
  });
  const prices = perSeries.flat().flatMap((v) => {
    const cents = usedOf(v);
    return cents === undefined ? [] : [cents];
  });
  const shelfUsual = median(prices);
  let estimate = 0;
  for (const books of perSeries) {
    const own = books.flatMap((v) => {
      const cents = usedOf(v);
      return cents === undefined ? [] : [cents];
    });
    const usual = own.length ? median(own) : shelfUsual;
    for (const v of books) estimate += usedOf(v) ?? usual;
  }
  estimate += unlisted * shelfUsual;
  return {
    cents: prices.reduce((sum, c) => sum + c, 0),
    priced: prices.length,
    volumes: perSeries.flat().length,
    unlisted,
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

export type FinishSeries = {
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

// the volumes out now that they don't own, each with its cheapest new copy.
// Ones not out yet are the calendar's, not missing
export function finishSeries(
  owned: Owned,
  volumes: ListedVolume[],
  copies: Map<string, Copies>,
  now = new Date(),
  fallbackCents = 0,
  // each volume's recorded new price: an unpriced one's own beats the
  // series' usual (see getRecordedMedians)
  recorded: Map<string, Pick<RecordedPrice, "new">> = new Map(),
): FinishSeries {
  const mine = ownedSet(owned);
  const listed = volumes.filter(isMainVolume);
  const out = listed.filter((v) => isOut(v, now));
  // every whole volume up to the newest one out, as the series' panel counts
  // them: a number the saved list skipped is still out, just not priced (no
  // ISBN: it's checked on the series page). One known to be coming isn't
  // and every number below one known to be coming (vol 22 due: 19 to 21
  // are out even if the list never had them)
  const coming = listed.filter((v) => !isOut(v, now)).map((v) => v.volume);
  const newest = Math.max(
    0,
    ...out.map((v) => v.volume),
    ...(coming.length ? [Math.ceil(Math.min(...coming)) - 1] : []),
  );
  const byNumber = new Map(listed.map((v) => [v.volume, v]));
  const missing: MissingVolume[] = [];
  for (let n = 1; n <= newest; n++) {
    if (mine.has(n)) continue;
    const v = byNumber.get(n);
    if (v && !isOut(v, now)) continue;
    missing.push({
      volume: n,
      isbn13: v?.isbn13 ?? "",
      title: v?.title ?? "",
      cheapest: v ? (copies.get(v.isbn13)?.new ?? null) : null,
    });
  }
  // a vol. 0 the list has (Jujutsu Kaisen 0) is part of the run too, unless
  // their list names it: the price pages count it the same way
  const zero = volumes.find((v) => v.volume === 0);
  if (zero && isOut(zero, now) && !mine.has(0))
    missing.unshift({
      volume: 0,
      isbn13: zero.isbn13,
      title: zero.title,
      cheapest: copies.get(zero.isbn13)?.new ?? null,
    });
  const priced = onceEach(missing.filter((m) => m.cheapest));
  const cents = priced.reduce((sum, m) => sum + m.cheapest!.cents, 0);
  // the series' usual new price, from any of its volumes priced (owned too):
  // what they've gone for, or failing that what they cost now
  const recordedNew = (isbn: string) => recorded.get(isbn)?.new ?? undefined;
  const seriesNew = volumes.flatMap((v) => {
    const c = recordedNew(v.isbn13) ?? copies.get(v.isbn13)?.new?.cents;
    return c === undefined ? [] : [c];
  });
  const usual = seriesNew.length ? median(seriesNew) : fallbackCents;
  // each unpriced one at its own recorded price, else the series' usual
  const unpriced = onceEach(missing.filter((m) => !m.cheapest)).map(
    (m) => (m.isbn13 && recordedNew(m.isbn13)) || usual,
  );
  const known = unpriced.every((c) => c > 0);
  // of every book out, the ones with a price today or one ever recorded
  const books = onceEach(out);
  const enough = enoughPriced(
    books.filter(
      (v) => copies.get(v.isbn13)?.new || recordedNew(v.isbn13) !== undefined,
    ).length,
    books.length,
  );
  return {
    missing,
    cents,
    priced: missing.filter((m) => m.cheapest).length,
    estimateCents:
      enough && (known || priced.length)
        ? cents + unpriced.reduce((sum, c) => sum + c, 0)
        : null,
  };
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
  recorded: Map<string, Pick<RecordedPrice, "new">> = new Map(),
): FinishSeries {
  const mine = ownedSet(owned);
  const lastListed = line.books.reduce((at, b, i) => (b.listed ? i : at), -1);
  const out = line.books.slice(0, lastListed + 1);
  const newOf = (isbn: string | null) =>
    isbn ? (copies.get(isbn)?.new ?? null) : null;
  const missing: MissingVolume[] = out
    .filter((b) => !b.volumes.every((v) => mine.has(v)))
    .map((b) => ({
      volume: b.number,
      isbn13: b.isbn13 ?? "",
      title: b.title ?? `${line.label} ${b.number}`,
      cheapest: newOf(b.isbn13),
      label: `${line.label} ${b.number}`,
      inside: b.volumes,
    }));
  const priced = missing.filter((m) => m.cheapest);
  const cents = priced.reduce((sum, m) => sum + m.cheapest!.cents, 0);
  const lineNew = out.flatMap((b) => {
    const c =
      (b.isbn13 && recorded.get(b.isbn13)?.new) || newOf(b.isbn13)?.cents;
    return c ? [c] : [];
  });
  const usual = lineNew.length ? median(lineNew) : 0;
  const unpriced = missing
    .filter((m) => !m.cheapest)
    .map(
      (m) =>
        (m.isbn13 && recorded.get(m.isbn13)?.new) ||
        usual ||
        fallbackCents * (m.inside?.length ?? 1),
    );
  return {
    missing,
    cents,
    priced: priced.length,
    estimateCents:
      enoughPriced(lineNew.length, out.length) &&
      (unpriced.every((c) => c > 0) || priced.length)
        ? cents + unpriced.reduce((sum, c) => sum + c, 0)
        : null,
  };
}

// the line a reader seems to collect, from the books they've recorded: the
// one of the same kind whose books match theirs, when those cover at least
// half of what they own. The same rule as the details page's
// (client/src/lib/editions.ts guessEdition), so the two agree
export function guessedLine(
  lines: EditionLine[],
  books: { edition: string; volumes: number[] }[],
  ownedCount: number,
): EditionLine | null {
  if (!lines.length || !ownedCount) return null;
  let best: { line: EditionLine; covered: number } | null = null;
  for (const line of lines) {
    const sets = new Set(line.books.map((b) => b.volumes.join()));
    const covered = books
      .filter((b) => b.edition === line.kind && sets.has(b.volumes.join()))
      .reduce((sum, b) => sum + b.volumes.length, 0);
    if (covered > (best?.covered ?? 0)) best = { line, covered };
  }
  return best && best.covered * 2 >= ownedCount ? best.line : null;
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
  return onceEach(
    volumes.flatMap((v) => {
      const day = releaseDay(v.published);
      return day && day > now && day <= until
        ? [
            {
              volume: v.volume,
              isbn13: v.isbn13,
              title: v.title,
              coverUrl: v.coverUrl ?? null,
              published: v.published!,
              month: v.published!.slice(0, 7),
            },
          ]
        : [];
    }),
  ).sort(
    (a, b) =>
      releaseDay(a.published)!.getTime() - releaseDay(b.published)!.getTime(),
  );
}
