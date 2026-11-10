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
};

export type FinishRow = {
  mangaId: number;
  name: string;
  missing: MissingVolume[];
  cents: number;
  priced: number;
  estimateCents: number | null;
};

export type ShelfTools = {
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
  // an estimate in whole dollars: cents would claim a precision it hasn't got
  const about = estimateCents ?? cents;
  return `about $${Math.round(about / 100).toLocaleString("en-US")}`;
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
