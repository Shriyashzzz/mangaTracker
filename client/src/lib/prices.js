import { API_URL, apiFetch } from "./api";

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

// the address a series is known by in search engines and the sitemap: the
// bare slug of AniList's name, which the server turns back into the series
export const seriesCanonicalPath = (name) => `/prices/series/${slugify(name)}`;

// a volume's address: the ISBN finds it, the title is there to be read
export const volumePath = (isbn13, title) => {
  const slug = title ? slugify(title) : "";
  return slug ? `/prices/${isbn13}/${slug}` : `/prices/${isbn13}`;
};

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

// edition covers come from our server's cover route (it finds the edition's
// cover once and redirects to it). Open Library's own URLs serve a blank 1x1
// image for missing covers unless asked for default=false, which makes them
// 404 instead, so onError can show our placeholder
export const coverSrc = (url) => {
  if (url?.startsWith("/api/")) return `${API_URL}${url}`;
  return url?.startsWith("https://covers.openlibrary.org/") &&
    !url.includes("?")
    ? `${url}?default=false`
    : url;
};

// a cover that fails on our cover route is usually Open Library asking us to
// slow down, so it's asked for again a couple of times, further apart each
// time, with the placeholder showing meanwhile
const COVER_RETRIES = 2;
const COVER_RETRY_MS = 6000;

// hides a cover that failed to load, revealing the placeholder behind it,
// and fades it in if a later try works
export const hideBrokenCover = (e) => {
  const img = e.currentTarget;
  const tries = Number(img.dataset.tries ?? 0);
  if (tries >= COVER_RETRIES || !img.src.includes("/api/prices/cover/")) {
    img.hidden = true;
    return;
  }
  // kept in the layout (not hidden) so a lazy image still loads
  img.style.opacity = "0";
  img.dataset.tries = String(tries + 1);
  img.addEventListener("load", () => (img.style.opacity = ""), { once: true });
  setTimeout(
    () => {
      const url = new URL(img.src);
      url.searchParams.set("try", String(tries + 1));
      img.src = url.href;
    },
    COVER_RETRY_MS * (tries + 1),
  );
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
