// The price pages' addresses. On their own, with nothing that needs a
// browser, so pure code (the New tab's links) and the server's tests can use
// them; lib/prices.ts passes them on.

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// links a series page; the name rides along because slugs lose punctuation
// the name goes along so a series we haven't stored yet is still found. Any
// line break or run of spaces in it (some catalog titles have them) becomes
// one space, so the link stays one clean address
export const seriesPath = (name: string) => {
  const clean = name.replace(/\s+/g, " ").trim();
  return `/prices/series/${slugify(clean)}?${new URLSearchParams({ name: clean })}`;
};

// the address a series is known by in search engines and the sitemap: the
// bare slug of AniList's name, which the server turns back into the series
export const seriesCanonicalPath = (name: string) =>
  `/prices/series/${slugify(name)}`;

// an edition's own page: its series' address and the edition's key
// (/prices/series/vagabond/vizbig). Keys are plain words ("vizbig", "3in1")
export const editionCanonicalPath = (seriesName: string, key: string) =>
  `${seriesCanonicalPath(seriesName)}/${encodeURIComponent(key)}`;

// a volume's address: the ISBN finds it, the title is there to be read
export const volumePath = (isbn13: string, title?: string | null) => {
  const slug = title ? slugify(title) : "";
  return slug ? `/prices/${isbn13}/${slug}` : `/prices/${isbn13}`;
};
