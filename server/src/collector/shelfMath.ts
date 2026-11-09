// The shelf tools' arithmetic, kept apart from the database so it can be
// tested on its own: what a shelf is worth, what finishing each series costs,
// and what's coming out when. Everything reads prices already saved; nothing
// here asks a store or a catalog.
import type { CheapestCopy } from "../models/priceQueries.js";

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

// "2027-03" counts from the first of the month, as on the price pages
export const releaseDay = (published?: string | null) => {
  if (!published) return null;
  const [y, m, d] = published.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m - 1, d || 1));
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
// something, once
const onceEach = <T extends { isbn13: string }>(items: T[]) => [
  ...new Map(items.map((i) => [i.isbn13, i])).values(),
];

// ---------- what the shelf is worth ----------

export type ShelfValue = {
  // the cheapest used copy of each owned volume we have a price for, added up
  cents: number;
  priced: number;
  // owned volumes we know the book of
  volumes: number;
  // the priced ones plus an estimate for the rest: each at its series' usual
  // used price, or the shelf's when the series has none yet. Null when nothing
  // is priced to go by
  estimateCents: number | null;
};

// what the owned volumes would fetch used: each one's cheapest used copy in
// stock. A volume with no used price isn't guessed at; `priced` says how many
// went in, so a part total never reads as the whole
export function shelfValue(
  series: { owned: Owned; volumes: ListedVolume[] }[],
  copies: Map<string, Copies>,
): ShelfValue {
  const usedOf = (v: ListedVolume) => copies.get(v.isbn13)?.used?.cents;
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
  return {
    cents: prices.reduce((sum, c) => sum + c, 0),
    priced: prices.length,
    volumes: perSeries.flat().length,
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
};

export type FinishSeries = {
  missing: MissingVolume[];
  // the priced ones added up (a book holding two missing volumes, once)
  cents: number;
  priced: number;
  // plus an estimate for the rest: each at the series' usual new price, or
  // `fallbackCents` (the shelf's) when none of the series is priced. Null
  // when there's nothing to go by
  estimateCents: number | null;
};

// the volumes out now that they don't own, each with its cheapest new copy.
// Ones not out yet are the calendar's, not missing
export function finishSeries(
  owned: Owned,
  volumes: ListedVolume[],
  copies: Map<string, Copies>,
  now = new Date(),
  fallbackCents = 0,
): FinishSeries {
  const mine = ownedSet(owned);
  const missing = volumes
    .filter((v) => isMainVolume(v) && !mine.has(v.volume) && isOut(v, now))
    .sort((a, b) => a.volume! - b.volume!)
    .map((v) => ({
      volume: v.volume!,
      isbn13: v.isbn13,
      title: v.title,
      cheapest: copies.get(v.isbn13)?.new ?? null,
    }));
  const priced = onceEach(missing.filter((m) => m.cheapest));
  const cents = priced.reduce((sum, m) => sum + m.cheapest!.cents, 0);
  // the series' usual new price, from any of its volumes priced (owned too)
  const seriesNew = volumes.flatMap((v) => {
    const c = copies.get(v.isbn13)?.new?.cents;
    return c === undefined ? [] : [c];
  });
  const usual = seriesNew.length ? median(seriesNew) : fallbackCents;
  const unpriced = onceEach(missing.filter((m) => !m.cheapest)).length;
  return {
    missing,
    cents,
    priced: missing.filter((m) => m.cheapest).length,
    estimateCents: usual || priced.length ? cents + unpriced * usual : null,
  };
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
