import { apiFetch } from "./api";

// throws with the server's own message so pages can show it as is
async function getJson(path, signal) {
  const res = await apiFetch(path, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      data?.error?.[0]?.msg ?? "Something went wrong. Try again.",
    );
  }
  return data;
}

export const searchVolumes = (q, signal) =>
  getJson(`/api/prices/search?${new URLSearchParams({ q })}`, signal).then(
    (d) => d.results,
  );

export const getVolume = (isbn, signal) =>
  getJson(`/api/prices/${encodeURIComponent(isbn)}`, signal);

export const searchSeries = (q, signal) =>
  getJson(
    `/api/prices/series-search?${new URLSearchParams({ q })}`,
    signal,
  ).then((d) => d.results);

// a pasted ISBN-10/13 (dashes and spaces fine), or null
export const asIsbn = (text) => {
  const digits = text.replace(/[\s-]/g, "");
  return /^(97[89]\d{10}|\d{9}[\dXx])$/.test(digits) ? digits : null;
};

export const getSeries = (name, signal) =>
  getJson(`/api/prices/series?${new URLSearchParams({ name })}`, signal);

export const getHighlights = (signal) =>
  getJson("/api/prices/highlights", signal);

// links a series page; the name rides along because slugs lose punctuation
export const seriesPath = (name) =>
  `/prices/series/${slugify(name)}?${new URLSearchParams({ name })}`;

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
export const formatCents = (cents) => usd.format(cents / 100);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function timeAgo(date) {
  const minutes = Math.round((new Date(date) - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

// Open Library serves a blank 1x1 image for covers it doesn't have; asking
// for default=false makes it 404 instead, so onError can show our placeholder
export const coverSrc = (url) =>
  url?.startsWith("https://covers.openlibrary.org/") && !url.includes("?")
    ? `${url}?default=false`
    : url;

// hides a cover that failed to load, revealing the placeholder behind it
export const hideBrokenCover = (e) => {
  e.currentTarget.hidden = true;
};

// "Jujutsu Kaisen, Vol. 24 (Shonen Jump)" -> "Jujutsu Kaisen", for the shelf
export const seriesName = (title) =>
  title
    .replace(/\(.*?\)/g, " ")
    .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

export const seriesTitle = seriesName;
