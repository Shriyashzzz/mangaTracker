import { breadcrumbs, clip } from "../../lib/seo";
import {
  coverSrc,
  formatCents,
  seriesCanonicalPath,
  volumePath,
} from "../../lib/prices";
import type { PageMeta } from "../../lib/seo";
import type { Series, VolumePrices } from "../../lib/types";

// what search engines and link previews see for the price pages

const absolute = (path: string) => new URL(path, location.origin).href;
// a full address, for search engines and link previews: covers served by
// the API come through this site in production, so they're relative otherwise
const absoluteImage = (url?: string | null) =>
  url ? absolute(coverSrc(url) ?? url) : undefined;
const dollars = (cents: number) => (cents / 100).toFixed(2);

export function volumeMeta({
  book,
  heading,
  series,
  offers,
  storeLinks,
}: VolumePrices): PageMeta {
  const seriesLabel = series.info?.name ?? series.name;
  // what the page is called; the address stays on book.title
  const name = heading ?? book.title;
  const path = volumePath(book.isbn13, book.title);
  const prices = offers.filter((o) => o.inStock).map((o) => o.priceCents);
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print" && o.inStock,
  );
  const stores = [...new Set([...offers, ...storeLinks].map((s) => s.store))];

  const description = clip(
    [
      `Compare US prices for ${name}`,
      stores.length
        ? `at ${stores.slice(0, 4).join(", ")} and more.`
        : "across stores.",
      best
        ? `Lowest new price we've found: ${formatCents(best.priceCents)} at ${best.store}.`
        : "",
      book.publisher ? `Published by ${book.publisher}.` : "",
    ].join(" "),
  );

  // a Product only with prices: Google needs offers (or reviews) for one,
  // and a volume nobody has priced yet is just a Book (as client/server.ts)
  const product = {
    "@type": prices.length ? ["Book", "Product"] : "Book",
    name,
    isbn: book.isbn13,
    url: absolute(path),
    ...(book.coverUrl && { image: absoluteImage(book.coverUrl) }),
    ...(book.authors && { author: { "@type": "Person", name: book.authors } }),
    ...(book.publisher && {
      publisher: { "@type": "Organization", name: book.publisher },
    }),
    // Product-only properties, with the Product type
    ...(prices.length && {
      gtin13: book.isbn13,
      ...(book.publisher && {
        brand: { "@type": "Brand", name: book.publisher },
      }),
    }),
    ...(book.year && { datePublished: String(book.year) }),
    isPartOf: { "@type": "BookSeries", name: seriesLabel },
    // only prices we actually have; a page with none makes no offer claims
    ...(prices.length && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: dollars(Math.min(...prices)),
        highPrice: dollars(Math.max(...prices)),
        offerCount: prices.length,
      },
    }),
  };

  return {
    title: `${name} price comparison`,
    description,
    path,
    image: book.coverUrl
      ? absoluteImage(book.coverUrl)
      : (series.info?.coverUrl ?? undefined),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        product,
        breadcrumbs([
          ["Price check", "/"],
          [seriesLabel, seriesCanonicalPath(seriesLabel)],
          [name, path],
        ]),
      ],
    },
  };
}

export function seriesMeta({ name, info, volumes }: Series): PageMeta {
  // AniList's name, so every way of reaching a series shares one URL
  const label = info?.name ?? name;
  const path = seriesCanonicalPath(label);
  const count = volumes.length;

  const description = clip(
    [
      count
        ? `Compare US prices for all ${count} ${label} volumes in English, from volume 1 on.`
        : `Compare US prices for ${label} manga volumes.`,
      info?.description ?? "",
    ].join(" "),
  );

  return {
    title: count
      ? `${label} manga prices, all ${count} volumes`
      : `${label} manga prices`,
    description,
    path,
    image: info?.coverUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BookSeries",
          name: label,
          url: absolute(path),
          ...(info?.description && {
            description: clip(info.description, 300),
          }),
          ...(info?.coverUrl && { image: info.coverUrl }),
          ...(info?.genres?.length && { genre: info.genres }),
          hasPart: volumes.slice(0, 100).map((v) => ({
            "@type": "Book",
            name: v.title,
            isbn: v.isbn13,
            url: absolute(volumePath(v.isbn13, v.title)),
            ...(v.volume != null && { position: v.volume }),
          })),
        },
        breadcrumbs([
          ["Price check", "/"],
          [label, path],
        ]),
      ],
    },
  };
}
