// Stores and search APIs list volumes by title, not ISBN, so these helpers
// decide whether a listing is the same volume we're pricing:
// same series name and same volume number.

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// the volume number in a title, NaN when there is none
export const volumeOf = (title: string): number =>
  Number(
    title.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1] ??
      title.match(/(\d+)\s*$/)?.[1] ??
      NaN,
  );

// the normalized series part of a title, for comparing
export const seriesOf = (title: string) =>
  normalize(
    title
      .replace(/\(.*?\)/g, "")
      .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
      .replace(/\s\d+\s*$/, ""),
  );

// "Jujutsu Kaisen, Vol. 24 (Shonen Jump)" -> "Jujutsu Kaisen", case kept
export const seriesName = (title: string) =>
  title
    .replace(/\(.*?\)/g, " ")
    .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
    .replace(/\s+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

// exact series match, for clean catalog titles (Google Books)
export const sameVolume = (a: string, b: string) =>
  seriesOf(a) === seriesOf(b) &&
  (volumeOf(a) === volumeOf(b) || (isNaN(volumeOf(a)) && isNaN(volumeOf(b))));

// box sets, bundles and "vols 1-3" never count as a single volume
const MULTI_VOLUME =
  /\b(box(ed)?\s*set|set of|collection|bundle|lot of|omnibus|\d+\s*-\s*\d+|vol(ume)?s\b)/i;

// looser match for shop listings, which pad titles ("Jujutsu Kaisen, Vol. 24
// (24) Paperback - by Gege Akutami"): the series words must all appear and
// the volume number must match
export const listingMatches = (listingTitle: string, bookTitle: string) => {
  if (MULTI_VOLUME.test(listingTitle)) return false;
  const series = seriesOf(bookTitle);
  const words = series.split(" ").filter((w) => w.length > 1);
  const listing = normalize(listingTitle);
  if (!words.every((w) => listing.includes(w))) return false;

  const wanted = volumeOf(bookTitle);
  if (isNaN(wanted)) return true;
  const vol = listingTitle.match(/(?:\bvol(?:ume)?\.?|#)\s*(\d+)/i)?.[1];
  return Number(vol) === wanted;
};

// "Frieren: Beyond Journey's End" -> "frieren-beyond-journey-s-end"
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
