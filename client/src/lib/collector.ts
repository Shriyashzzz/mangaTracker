// The shelf tools (server/src/collector): what a shelf is worth, finishing
// each series, the release calendar, and the stores' sales. All read prices
// already saved, so none of them ever sets off a price check.
import { getJson } from "./api";
import { formatCents } from "./prices";

export type CheapestCopy = { cents: number; store: string; url: string | null };

export type MissingVolume = {
  volume: number;
  isbn13: string;
  title: string;
  cheapest: CheapestCopy | null;
  // a book of the edition they collect: "Deluxe 3" and the volumes inside;
  // `volume` is then its number in that edition
  label?: string;
  inside?: number[];
};

export type FinishRow = {
  mangaId: number;
  name: string;
  missing: MissingVolume[];
  cents: number;
  priced: number;
  estimateCents: number | null;
  // counted in this edition's books ("Deluxe"), not single volumes
  edition?: string;
};

export type ShelfTools = {
  // what they've said they paid, added up, and for how many books
  spent?: { cents: number; books: number };
  value: {
    cents: number;
    priced: number;
    volumes: number;
    // owned volumes of series with no saved list: in the estimate only
    unlisted: number;
    estimateCents: number | null;
  };
  finish: FinishRow[];
  finishCents: number;
  finishPriced: number;
  finishMissing: number;
  finishEstimateCents: number | null;
  // series left out of that total: too little of them priced yet
  finishUncosted?: number;
};

export type CalendarVolume = {
  volume: number | null;
  isbn13: string;
  title: string;
  coverUrl: string | null;
  published: string;
  month: string;
  mangaId: number;
  name: string;
  // the series' cover on the shelf, for a volume with none of its own yet
  seriesCover: string | null;
  owned: boolean;
};
export type CalendarMonth = { month: string; volumes: CalendarVolume[] };

export type Deal = {
  store: string;
  text: string;
  code?: string;
  url: string;
  ends: string;
};

export const getShelfTools = (signal?: AbortSignal) =>
  getJson<ShelfTools>("/api/collector/shelf", signal);
export const getCalendar = (signal?: AbortSignal) =>
  getJson<{ months: CalendarMonth[] }>("/api/collector/calendar", signal).then(
    (r) => r.months,
  );
export const getDeals = (signal?: AbortSignal) =>
  getJson<{ deals: Deal[] }>("/api/collector/deals", signal).then(
    (r) => r.deals,
  );

// a dollar amount, without the cents once it's big enough not to need them
export const money = (cents: number) =>
  cents >= 100_000
    ? `$${Math.round(cents / 100).toLocaleString("en-US")}`
    : formatCents(cents);

// what a total says: the real one when everything's priced, else "about" the
// estimate, and nothing when there's nothing to go by
export function totalText(
  cents: number,
  priced: number,
  count: number,
  estimateCents: number | null,
) {
  if (!count || (!priced && estimateCents === null)) return null;
  if (priced === count) return money(cents);
  // too little priced to say a total: a few volumes' prices aren't the run's
  if (estimateCents === null) return null;
  // an estimate in whole dollars: cents would claim a precision it hasn't got
  return `about $${Math.round(estimateCents / 100).toLocaleString("en-US")}`;
}

// "December 2026"
export const monthName = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

// "Dec 15", or "Dec" when the catalog only gives the month
export const dayName = (published: string) => {
  const [y, m, d] = published.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d || 1)).toLocaleDateString("en-US", {
    month: "short",
    ...(d ? { day: "numeric" } : {}),
    timeZone: "UTC",
  });
};

// "December" (the month alone)
export const monthOnly = (month: string) => monthName(month).split(" ")[0]!;

// today as the calendar counts it, in the reader's own time zone: "2026-11-10"
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

// the days a month's page shows, Sunday first: the month's own, padded with
// the days around it to whole weeks. Each "YYYY-MM-DD", `inMonth` false for
// the padding
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const last = new Date(Date.UTC(y!, m!, 0));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const days: { iso: string; day: number; inMonth: boolean }[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1))
    days.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m! - 1,
    });
  return days;
}
