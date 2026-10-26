import { breadcrumbs, clip } from "../../lib/seo";
import { coverSrc, formatCents, seriesPath } from "../../lib/prices";

// what search engines and link previews see for the price pages

const absolute = (path) => new URL(path, location.origin).href;
const dollars = (cents) => (cents / 100).toFixed(2);

export function volumeMeta({ book, series, offers, storeLinks }) {
  const seriesLabel = series.info?.name ?? series.name;
  const path = `/prices/${book.isbn13}`;
  const prices = offers.filter((o) => o.inStock).map((o) => o.priceCents);
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print" && o.inStock,
  );
  const stores = [...new Set([...offers, ...storeLinks].map((s) => s.store))];

  const description = clip(
    [
      `Compare US prices for ${book.title}`,
      stores.length
        ? `at ${stores.slice(0, 4).join(", ")} and more.`
        : "across stores.",
      best
        ? `Cheapest new copy: ${formatCents(best.priceCents)} at ${best.store}.`
        : "",
      book.publisher ? `Published by ${book.publisher}.` : "",
    ].join(" "),
  );

  const product = {
    "@type": ["Book", "Product"],
    name: book.title,
    isbn: book.isbn13,
    gtin13: book.isbn13,
    url: absolute(path),
    ...(book.coverUrl && { image: coverSrc(book.coverUrl) }),
    ...(book.authors && { author: { "@type": "Person", name: book.authors } }),
    ...(book.publisher && {
      publisher: { "@type": "Organization", name: book.publisher },
      brand: { "@type": "Brand", name: book.publisher },
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
    title: `${book.title} price comparison`,
    description,
    path,
    image: book.coverUrl ? coverSrc(book.coverUrl) : series.info?.coverUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        product,
        breadcrumbs([
          ["Price check", "/"],
          [seriesLabel, seriesPath(seriesLabel)],
          [book.title, path],
        ]),
      ],
    },
  };
}

export function seriesMeta({ name, info, volumes }) {
  // AniList's name, so every way of reaching a series shares one URL
  const label = info?.name ?? name;
  const path = seriesPath(label);
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
    title: count ? `${label} manga prices, all ${count} volumes` : `${label} manga prices`,
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
          ...(info?.description && { description: clip(info.description, 300) }),
          ...(info?.coverUrl && { image: info.coverUrl }),
          ...(info?.genres?.length && { genre: info.genres }),
          hasPart: volumes.slice(0, 100).map((v) => ({
            "@type": "Book",
            name: v.title,
            isbn: v.isbn13,
            url: absolute(`/prices/${v.isbn13}`),
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
