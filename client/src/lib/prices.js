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
export const seriesTitle = (title) =>
  title
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
    .trim();
