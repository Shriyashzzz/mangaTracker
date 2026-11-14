import { ratingMarkup } from "../../lib/reviewMarkup";
import type { VolumeReviews } from "../../lib/reviews";
import { breadcrumbs, clip } from "../../lib/seo";
import {
  coverSrc,
  formatCents,
  seriesCanonicalPath,
  volumePath,
} from "../../lib/prices";
import type { PageMeta } from "../../lib/seo";
import { isCollection, type Series, type VolumePrices } from "../../lib/types";
import { seriesCost } from "../../lib/finishCost";
import { notOutYet } from "../../lib/releaseDate";

// what search engines and link previews see for the price pages

const absolute = (path: string) => new URL(path, location.origin).href;
// a full address, for search engines and link previews: covers served by
// the API come through this site in production, so they're relative otherwise
const absoluteImage = (url?: string | null) =>
  url ? absolute(coverSrc(url) ?? url) : undefined;
const dollars = (cents: number) => (cents / 100).toFixed(2);
// a seller on a big store ("eBay - pele-onfyah") goes by the store's name
const shopName = (store: string) => store.split(/\s[-–—|]\s/)[0]!.trim();
// a total: "$1,560", or with cents when it's exact
const total = (cents: number, exact: boolean) =>
  exact
    ? formatCents(cents)
    : `$${(Math.round(cents / 1000) * 10).toLocaleString("en-US")}`;

export function volumeMeta(
  { book, heading, series, offers }: VolumePrices,
  // readers' reviews of it, once they've loaded
  reviews: VolumeReviews | null = null,
): PageMeta {
  const seriesLabel = series.info?.name ?? series.name;
  // what the page is called; the address stays on book.title
  const name = heading ?? book.title;
  const path = volumePath(book.isbn13, book.title);
  // box sets and omnibuses are listed, but aren't this volume's price
  // new print copies only, as the "New from" line (as client/server.ts)
  const prices = offers
    .filter(
      (o) =>
        o.inStock &&
        !isCollection(o) &&
        o.format === "print" &&
        o.condition === "new",
    )
    .map((o) => o.priceCents);
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print" && o.inStock,
  );
  // stores readers know by name; the rest counted, never named (a search
  // result saying "at nuclearwaste" reads as spam)
  const named = [
    ...new Set(
      offers.filter((o) => o.knownStore).map((o) => shopName(o.store)),
    ),
  ].slice(0, 4);
  const storeCount = new Set(offers.map((o) => shopName(o.store))).size;
  const others = storeCount - named.length;
  const storesLine = named.length
    ? `at ${named.join(", ")}${others > 0 ? ` and ${others} more store${others === 1 ? "" : "s"}` : ""}.`
    : storeCount
      ? `from ${storeCount} store${storeCount === 1 ? "" : "s"}.`
      : "across stores.";

  const description = clip(
    [
      best
        ? `${name}: new from ${formatCents(best.priceCents)}${best.knownStore ? ` at ${shopName(best.store)}` : ""}.`
        : "",
      best ? "Compare US prices" : `Compare US prices for ${name}`,
      storesLine,
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
    // readers' rating, and their reviews that aren't spoilers
    ...ratingMarkup(
      reviews,
      (reviews?.reviews ?? []).filter((review) => !review.spoiler),
    ),
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

  // what collecting it costs, out now only, as the page's box and the site
  // server say it
  const out = volumes.filter(
    (v) =>
      v.volume >= 0 && Number.isInteger(v.volume) && !notOutYet(v.published),
  );
  const cost = seriesCost(out);
  // only once most of it is priced, as the page's box and the site server
  // (client/server.ts) say it
  const costLine =
    cost?.estimateCents != null && cost.enough
      ? `Every ${label} volume new: ${cost.complete ? "" : "about "}${total(cost.estimateCents, cost.complete)} for all ${cost.volumes}${out.length < volumes.length ? " out now" : ""}.`
      : "";

  const description = clip(
    [
      `Compare US prices for every ${label} volume in English.`,
      costLine,
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
