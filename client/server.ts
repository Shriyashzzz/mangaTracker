// Serves the built site (dist/) in production (`npm start`, run with tsx), in place of `serve -s dist`.
// Same files, same single-page fallback, plus one thing static hosting can't
// do: for volume and series pages it writes that page's title, description,
// preview image and structured data into index.html before sending it. Link
// previews (Discord, iMessage, X, WhatsApp) and crawlers that don't run
// JavaScript only ever see this first HTML. The React app then takes over
// and keeps these tags up to date as people move around, as before.
//
// It also passes the browser's /api requests on to the API, so in production
// the API only needs Railway's private network (API_INTERNAL_URL) and the
// site and API share one domain.
//
import express, { type Request, type Response } from "express";
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAppPage } from "./pagePaths.ts";
import { visitorIp } from "./visitorIp.ts";
import { WHY_COLLECTORS } from "./src/lib/whyCollectors.ts";
import { FAQ, FAQ_DESCRIPTION, faqJsonLd } from "./src/lib/content/faq.ts";
import {
  answerSentence,
  INDEX_META,
  latestAnswerText,
  latestStop,
  seasonHeading,
  showMeta,
  showQuestion,
  showQuestions,
  tableRow,
  withoutThe,
  type AnimeStop,
} from "./src/lib/afterAnimeText.ts";

const DIST = fileURLToPath(new URL("./dist/", import.meta.url));
// where this server reaches the API: the private address on Railway
// (http://mangatracker.railway.internal:8080), the public one otherwise
const API_URL = (
  process.env.API_INTERNAL_URL || process.env.VITE_API_URL
)?.replace(/\/+$/, "");
const PORT = process.env.PORT || 3000;
// a preview that takes longer than this isn't worth holding the page for
const API_TIMEOUT_MS = 2500;
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 1000;

const SITE_NAME = "Manga Tracker";
const template = readFileSync(`${DIST}index.html`, "utf8");

// ---------- the tags, matching client/src/lib/seo.js ----------

const escapeHtml = (text: unknown) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const clip = (text: string | null | undefined, max = 155) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
// a total: "$1,560", or with cents when it's exact ("$1,357.35")
const usdTotal = (cents: number, exact: boolean) =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: exact ? 2 : 0,
    maximumFractionDigits: exact ? 2 : 0,
  })}`;
// /api/ covers are served through this site, so link previews can fetch them
const apiImage = (url: string | null, origin: string) =>
  url?.startsWith("/api/") ? origin + url : url;

const volumePath = (isbn13: string, title: string) => {
  const slug = title ? slugify(title) : "";
  return slug ? `/prices/${isbn13}/${slug}` : `/prices/${isbn13}`;
};
const seriesPath = (name: string) => `/prices/series/${slugify(name)}`;

// what the API's /summary routes return (server/src/prices/service.ts)
type VolumeSummary = {
  isbn13: string;
  title: string;
  // what the page is called; the address stays on title
  heading?: string;
  authors: string | null;
  publisher: string | null;
  year: number | null;
  coverUrl: string | null;
  seriesName: string;
  seriesCoverUrl: string | null;
  stores: string[];
  lowCents: number | null;
  highCents: number | null;
  offerCount: number;
  // `known`: the store's name when readers know it (Walmart, eBay), so a
  // search result never says "at nuclearwaste"
  bestNew: { store: string; priceCents: number; known?: string | null } | null;
  // the stores readers know by name, from `stores`
  knownStores?: string[];
  // how many stores, a big store's sellers counted as the store
  storeCount?: number;
  // cheapest first; optional while an older API is still running
  offers?: {
    store: string;
    condition: string;
    format: string;
    priceCents: number;
  }[];
  // the release date ("2027-03-30" or "2014-05"), page count, the series'
  // description and the volumes around it; optional like offers
  published?: string | null;
  pages?: number | null;
  seriesDescription?: string | null;
  prev?: NearbyVolume | null;
  next?: NearbyVolume | null;
  nearby?: NearbyVolume[];
};
type NearbyVolume = { isbn13: string; title: string; volume: number };
type SeriesSummary = {
  name: string;
  description: string | null;
  coverUrl: string | null;
  genres: string[];
  // `volume`: its number, so the list reads "One Piece, Vol. 28" whatever
  // the catalog called the book; missing from an older API
  volumes?: {
    isbn13: string;
    title: string;
    fromCents: number | null;
    volume?: number | null;
    published?: string | null;
  }[];
};
// what the API's /api/share/:code returns, as far as a preview needs it
// (server/src/util/shelf/sharedShelf.ts)
type SharedShelf = {
  displayName: string;
  manga: {
    name: string;
    image: string | null;
    status: boolean;
    planned?: boolean;
    volumesOwned?: number | null;
    ownedList?: number[];
  }[];
};
// the tags one page gets, and the plain HTML that fills #root until the
// app starts (crawlers that don't run JavaScript only ever see this). A
// shared shelf only wants its link preview: no structured data, no body, and
// search engines kept away
type Tags = {
  title: string;
  description: string;
  path: string;
  image: string | null | undefined;
  // one object, or several (the page's own and its breadcrumbs)
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  body?: string;
  noindex?: boolean;
  // a cover is tall: a big preview would crop it to a wide strip
  smallImage?: boolean;
  // the title as it is, without " | Manga Tracker" (the home page's own)
  fullTitle?: boolean;
};

// ---------- the page body, for crawlers ----------

// AniList descriptions carry <br> and <i>: text only
const plainText = (text: string) =>
  text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const offerKind = (o: { condition: string; format: string }) =>
  o.format === "ebook"
    ? "Ebook"
    : o.condition.charAt(0).toUpperCase() + o.condition.slice(1);

// plain and readable for the moment before the app replaces it
const BODY_STYLE = `<style>
      .crawl-page { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem; font-family: "IBM Plex Sans", system-ui, sans-serif; line-height: 1.5; }
      .crawl-page > * + * { margin-top: 0.75rem; }
      .crawl-page h2 { margin-top: 1.5rem; clear: both; }
      .crawl-page img { float: right; width: 8rem; height: auto; margin: 0.25rem 0 1rem 1rem; }
      .crawl-page dl { display: grid; grid-template-columns: auto 1fr; gap: 0.15rem 1rem; }
      .crawl-page dt { font-weight: 600; }
      .crawl-page table { border-collapse: collapse; }
      .crawl-page td, .crawl-page th { padding: 0.15rem 1rem 0.15rem 0; text-align: left; }
      .crawl-page a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
    </style>`;

const crumbs = (links: [string, string][]) =>
  `<nav>${links.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join(" › ")}</nav>`;

// "2027-03-30" -> "March 30, 2027"; "2014-05" -> "May 2014"
const releaseDate = (published: string) => {
  const [y, m, d] = published.split("-").map(Number);
  if (!y || !m) return published;
  const date = new Date(Date.UTC(y, m - 1, d || 1));
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    ...(d ? { day: "numeric" } : {}),
  });
};

const volumeLink = (n: NearbyVolume, label = `Vol. ${n.volume}`) =>
  `<a href="${escapeHtml(volumePath(n.isbn13, n.title))}">${escapeHtml(label)}</a>`;

function volumeBody(v: VolumeSummary, image: string | null | undefined) {
  const name = v.heading ?? v.title;
  const facts = [
    v.authors && ["Author", v.authors],
    v.publisher && ["Publisher", v.publisher],
    v.published
      ? ["Release date", releaseDate(v.published)]
      : v.year && ["Published", String(v.year)],
    v.pages && ["Pages", String(v.pages)],
    ["ISBN", v.isbn13],
  ].filter(Boolean) as [string, string][];
  const nearby = v.nearby ?? [];
  const offers = v.offers ?? [];
  return `<main class="crawl-page">
      ${crumbs([
        ["/", SITE_NAME],
        ["/series", "Series"],
        [seriesPath(v.seriesName), v.seriesName],
      ])}
      <h1>${escapeHtml(name)} price comparison</h1>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`${name} cover`)}" />` : ""}
      <p>${
        v.bestNew
          ? `Lowest new price we've found: ${usd(v.bestNew.priceCents)} at ${escapeHtml(v.bestNew.store)}.`
          : `US prices for ${escapeHtml(name)}, from ${escapeHtml(v.seriesName)}.`
      }</p>
      <dl>${facts.map(([k, val]) => `<dt>${k}</dt><dd>${escapeHtml(val)}</dd>`).join("")}</dl>
      ${
        offers.length
          ? `<h2>Prices</h2>
      <table>
        <thead><tr><th>Store</th><th>Copy</th><th>Price</th></tr></thead>
        <tbody>${offers.map((o) => `<tr><td>${escapeHtml(o.store)}</td><td>${escapeHtml(offerKind(o))}</td><td>${usd(o.priceCents)}</td></tr>`).join("")}</tbody>
      </table>`
          : ""
      }
      ${
        v.prev || v.next
          ? `<p>${[
              v.prev && `Previous: ${volumeLink(v.prev)}`,
              v.next && `Next: ${volumeLink(v.next)}`,
            ]
              .filter(Boolean)
              .join(" · ")}</p>`
          : ""
      }
      ${
        v.seriesDescription
          ? `<h2>About ${escapeHtml(v.seriesName)}</h2>
      <p>${escapeHtml(clip(plainText(v.seriesDescription), 400))}</p>`
          : ""
      }
      ${
        nearby.length
          ? `<h2>More ${escapeHtml(v.seriesName)} volumes</h2>
      <ul>${nearby.map((n) => `<li>${volumeLink(n, `${v.seriesName}, Vol. ${n.volume}`)}</li>`).join("")}</ul>
      <p><a href="${escapeHtml(seriesPath(v.seriesName))}">Every ${escapeHtml(v.seriesName)} volume and its prices</a></p>`
          : ""
      }
    </main>`;
}

// what buying every volume new costs, as the series page's box says it: the
// priced ones plus the rest at their middle price, with one priced or more;
// "about", to the nearest $10, unless every one is priced
function seriesCostLine(s: SeriesSummary) {
  // out now only, as the page counts them: a preorder isn't bought yet
  const today = new Date().toISOString().slice(0, 10);
  const volumes = (s.volumes ?? []).filter(
    (v) => !v.published || v.published.slice(0, 10) <= today,
  );
  const priced = volumes.flatMap((v) =>
    v.fromCents != null ? [v.fromCents] : [],
  );
  // in a search result only once a quarter of it is priced (3 at least):
  // the page's box shows a thinner estimate, with how many it rests on
  if (priced.length < Math.max(3, volumes.length / 4)) return null;
  const sorted = [...priced].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const usual =
    sorted.length % 2
      ? sorted[mid]!
      : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  const total =
    priced.reduce((sum, c) => sum + c, 0) +
    (volumes.length - priced.length) * usual;
  const exact = priced.length === volumes.length;
  const outNow = volumes.length < (s.volumes ?? []).length ? " out now" : "";
  return `Every ${s.name} volume new: ${exact ? "" : "about "}${usdTotal(exact ? total : Math.round(total / 1000) * 1000, exact)} for all ${volumes.length}${outNow}.`;
}

function seriesBody(s: SeriesSummary) {
  const volumes = s.volumes ?? [];
  return `<main class="crawl-page">
      ${crumbs([
        ["/", SITE_NAME],
        ["/series", "Series"],
      ])}
      <h1>${escapeHtml(s.name)} manga prices</h1>
      ${s.coverUrl ? `<img src="${escapeHtml(s.coverUrl)}" alt="${escapeHtml(`${s.name} cover`)}" />` : ""}
      <p>Compare US prices for every ${escapeHtml(s.name)} volume in English.</p>
      ${seriesCostLine(s) ? `<p>${escapeHtml(seriesCostLine(s))}</p>` : ""}
      ${s.description ? `<p>${escapeHtml(clip(plainText(s.description), 600))}</p>` : ""}
      ${s.genres?.length ? `<p>Genres: ${s.genres.map(escapeHtml).join(", ")}</p>` : ""}
      ${
        volumes.length
          ? `<h2>Volumes</h2>
      <ul>${volumes.map((v) => `<li><a href="${escapeHtml(volumePath(v.isbn13, v.title))}">${escapeHtml(v.volume != null ? `${s.name}, Vol. ${v.volume}` : v.title)}</a>${v.fromCents != null ? ` from ${usd(v.fromCents)}` : ""}</li>`).join("")}</ul>`
          : ""
      }
    </main>`;
}

// the stores readers know by name, then how many others: "at Walmart, eBay
// and 3 more stores." An older API without knownStores names them all
const storesLine = (v: VolumeSummary) => {
  const named = (v.knownStores ?? v.stores).slice(0, 4);
  const total = v.storeCount ?? v.stores.length;
  const others = total - named.length;
  const more =
    others > 0 ? `${others} more store${others === 1 ? "" : "s"}` : "";
  if (!named.length)
    return total
      ? `from ${total} store${total === 1 ? "" : "s"}.`
      : "across stores.";
  return `at ${named.join(", ")}${more ? ` and ${more}` : ""}.`;
};

// the trail the page shows, for search results: Manga Tracker > Series > ...
const breadcrumbLd = (origin: string, links: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: links.map(([path, name], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: origin + path,
  })),
});

function volumeTags(v: VolumeSummary, origin: string): Tags {
  const path = volumePath(v.isbn13, v.title);
  const description = clip(
    [
      // the lowest price first: it's what a search result shows
      v.bestNew
        ? `${v.heading ?? v.title}: new from ${usd(v.bestNew.priceCents)}${v.bestNew.known ? ` at ${v.bestNew.known}` : ""}.`
        : "",
      v.bestNew
        ? "Compare US prices"
        : `Compare US prices for ${v.heading ?? v.title}`,
      storesLine(v),
      v.publisher ? `Published by ${v.publisher}.` : "",
    ].join(" "),
  );
  const image = apiImage(v.coverUrl, origin) ?? v.seriesCoverUrl;
  const jsonLd = {
    "@context": "https://schema.org",
    // a Product only with prices: Google needs offers (or reviews) for one,
    // and a volume nobody has priced yet is just a Book
    "@type": v.offerCount ? ["Book", "Product"] : "Book",
    name: v.heading ?? v.title,
    isbn: v.isbn13,
    url: origin + path,
    ...(image && { image }),
    ...(v.authors && { author: { "@type": "Person", name: v.authors } }),
    ...(v.publisher && {
      publisher: { "@type": "Organization", name: v.publisher },
    }),
    // Product-only properties, with the Product type
    ...(v.offerCount && {
      gtin13: v.isbn13,
      ...(v.publisher && { brand: { "@type": "Brand", name: v.publisher } }),
    }),
    ...(v.year && { datePublished: String(v.year) }),
    isPartOf: { "@type": "BookSeries", name: v.seriesName },
    ...(v.offerCount && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: ((v.lowCents ?? 0) / 100).toFixed(2),
        highPrice: ((v.highCents ?? 0) / 100).toFixed(2),
        offerCount: v.offerCount,
      },
    }),
  };
  return {
    title: `${v.heading ?? v.title} price comparison`,
    description,
    path,
    image,
    jsonLd: [
      jsonLd,
      breadcrumbLd(origin, [
        ["/", SITE_NAME],
        ["/series", "Series"],
        [seriesPath(v.seriesName), v.seriesName],
        [path, v.heading ?? v.title],
      ]),
    ],
    body: volumeBody(v, image),
  };
}

function seriesTags(s: SeriesSummary, origin: string): Tags {
  const path = seriesPath(s.name);
  return {
    // as the app's own title (pages/Prices/pageMeta.ts seriesMeta)
    title: s.volumes?.length
      ? `${s.name} manga prices, all ${s.volumes.length} volumes`
      : `${s.name} manga prices`,
    description: clip(
      `Compare US prices for every ${s.name} volume in English. ${seriesCostLine(s) ?? ""} ${s.description ?? ""}`,
    ),
    path,
    image: s.coverUrl,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BookSeries",
        name: s.name,
        url: origin + path,
        ...(s.description && { description: clip(s.description, 300) }),
        ...(s.coverUrl && { image: s.coverUrl }),
        ...(s.genres?.length && { genre: s.genres }),
      },
      breadcrumbLd(origin, [
        ["/", SITE_NAME],
        ["/series", "Series"],
        [path, s.name],
      ]),
    ],
    body: seriesBody(s),
  };
}

// ---------- the app's own pages ----------

// the home page's title and description, as index.html has them
const HOME_TITLE =
  /<title>([\s\S]*?)<\/title>/.exec(template)?.[1]?.trim() ?? SITE_NAME;
const HOME_DESCRIPTION =
  /<meta\s+name="description"\s+content="([^"]*)"/.exec(template)?.[1] ?? "";

type Highlights = { trending?: { name: string; slug: string }[] };
type SeriesIndexEntry = { name: string; knownVolumes?: number };

const linkList = (links: [href: string, label: string][]) =>
  `<ul>${links.map(([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join("")}</ul>`;

const SITE_LINKS: [string, string][] = [
  ["/series", "All manga series"],
  ["/deals", "Manga deals"],
  ["/after-the-anime", "Where does the anime leave off?"],
  ["/faq", "Questions and answers"],
  ["/about", "About Manga Tracker"],
  ["/updates", "What's new"],
];

function homeTags(h: Highlights | null): Tags {
  const trending = h?.trending ?? [];
  return {
    title: HOME_TITLE,
    fullTitle: true,
    // index.html's, decoded: render escapes it again
    description: HOME_DESCRIPTION.replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
    path: "/",
    image: null,
    body: `<main class="crawl-page">
      <h1>Compare US manga prices</h1>
      <p>See what US stores charge for every English manga volume, new and used, keep your place in every series you read, and find out when new volumes come out.</p>
      ${
        trending.length
          ? `<h2>Popular series</h2>
      ${linkList(trending.map((t) => [`/prices/series/${t.slug}`, t.name]))}`
          : ""
      }
      <h2>Why collectors use it</h2>
      ${WHY_COLLECTORS.map(
        (w) => `<h3>${escapeHtml(w.title)}</h3>
      <p>${escapeHtml(w.body)} <a href="${escapeHtml(w.link)}">${escapeHtml(w.label)}</a></p>`,
      ).join("\n      ")}
      ${linkList(SITE_LINKS)}
    </main>`,
  };
}

// every series, A to Z, linked: the way in to each one's page
function seriesIndexTags(all: SeriesIndexEntry[]): Tags {
  // only series with volumes to show, as the sitemap has them
  const sorted = all
    .filter((s) => s.knownVolumes !== 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    // as SeriesIndex.tsx has it
    title: "All manga series",
    description: `Browse ${sorted.length || "every"} manga series and compare what US stores charge for each volume.`,
    path: "/series",
    image: null,
    body: `<main class="crawl-page">
      ${crumbs([["/", SITE_NAME]])}
      <h1>All series</h1>
      <p>Every manga series on Manga Tracker, A to Z. Each one lists its English volumes with what US stores charge for them.</p>
      ${linkList(sorted.map((s) => [seriesPath(s.name), s.name]))}
    </main>`,
  };
}

// /deals: what the page lists, as links search engines can follow. The title
// and description are the app's own (pages/Prices/Deals.tsx)
type Deal = {
  isbn13: string;
  title: string;
  priceCents: number;
  avgCents: number;
};

function dealsTags(deals: Deal[]): Tags {
  return {
    title: "Manga deals: volumes under their usual price",
    description:
      "English manga volumes selling for less than they usually do right now, from the prices Manga Tracker checks across US stores. Biggest discounts first.",
    path: "/deals",
    image: null,
    body: `<main class="crawl-page">
      ${crumbs([["/", SITE_NAME]])}
      <h1>Manga deals</h1>
      <p>Volumes selling for less than they usually do, biggest discount first. Open one to see every store's price.</p>
      ${
        deals.length
          ? `<ul>${deals
              .map(
                (d) =>
                  `<li><a href="${escapeHtml(volumePath(d.isbn13, d.title))}">${escapeHtml(d.title)}</a> ${usd(d.priceCents)}, usually ${usd(d.avgCents)}</li>`,
              )
              .join("")}</ul>`
          : "<p>No deals right now.</p>"
      }
      ${linkList(SITE_LINKS.filter(([href]) => href !== "/deals"))}
    </main>`,
  };
}

// what /api/after-anime sends, as much of it as these pages use
type AfterAnimeShow = { name: string; slug: string };
type AfterAnime = {
  name: string;
  slug: string;
  coverUrl: string | null;
  stops: AnimeStop[];
};

// /after-the-anime: every show with an answer, linked. The title and
// description are the app's own (src/lib/afterAnimeText.ts)
const afterAnimeShowPath = (name: string) =>
  `/after-the-anime/${slugify(name)}`;

function afterAnimeIndexTags(shows: AfterAnimeShow[]): Tags {
  return {
    title: INDEX_META.title,
    description: INDEX_META.description,
    path: "/after-the-anime",
    image: null,
    body: `<main class="crawl-page">
      ${crumbs([["/", SITE_NAME]])}
      <h1>Where does the anime leave off?</h1>
      <p>Finished a season? Look the show up to see which chapter of the manga to start at, which volume that's in, and what it costs.</p>
      ${linkList(shows.map((show) => [afterAnimeShowPath(show.name), show.name]))}
      ${linkList(SITE_LINKS.filter(([href]) => href !== "/after-the-anime"))}
    </main>`,
  };
}

// one show: each season's answer in words, as the page says it. A show with
// no answer isn't indexed (showMeta)
function afterAnimeTags(
  show: AfterAnime,
  others: AfterAnimeShow[],
  origin: string,
): Tags {
  // never null for a show that loaded
  const meta = showMeta(show, false, origin)!;
  const latest = latestStop(show.stops);
  // newest first, as the page has them
  const rows = [...show.stops].reverse().map((stop) => {
    const row = tableRow(stop);
    return `<tr><th scope="row">${escapeHtml(row.watched)}</th><td>${escapeHtml(row.start)}</td><td>${escapeHtml(row.volume)}</td></tr>`;
  });
  const seasons = [...show.stops]
    .reverse()
    .map(
      (stop) =>
        `<h2>${escapeHtml(seasonHeading(stop))}</h2><p>${escapeHtml(answerSentence(stop))}</p>`,
    );
  const questions = showQuestions(show).map(
    ({ q, a, list }) =>
      `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>${
        list?.length
          ? `<ul>${list.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
          : ""
      }`,
  );
  const more = others.filter((other) => other.slug !== show.slug).slice(0, 12);
  return {
    title: meta.title,
    description: meta.description ?? INDEX_META.description,
    path: meta.path!,
    image: show.coverUrl,
    smallImage: true,
    noindex: meta.noindex,
    jsonLd: meta.jsonLd,
    body: `<main class="crawl-page">
      ${crumbs([
        ["/", SITE_NAME],
        ["/after-the-anime", "After the anime"],
      ])}
      <h1>${escapeHtml(meta.title)}</h1>
      ${
        latest
          ? `<p>${escapeHtml(latestAnswerText(latest))}</p>
      <table><thead><tr><th>If you watched</th><th>Start reading at</th><th>Volume</th></tr></thead><tbody>${rows.join("")}</tbody></table>
      ${seasons.join("")}
      <h2>Questions</h2>${questions.join("")}`
          : "<p>No answer yet.</p>"
      }
      <p><a href="${escapeHtml(seriesPath(show.name))}">Compare prices for every ${escapeHtml(show.name)} volume</a></p>
      ${more.length ? `<h2>More shows</h2>${linkList(more.map((other) => [afterAnimeShowPath(other.name), `Where does the ${withoutThe(other.name)} anime leave off?`]))}` : ""}
    </main>`,
  };
}

// About, What's new and Acknowledgements: their titles and descriptions as
// the pages set them (usePageMeta), and a line of what each is
const STATIC_PAGES: Record<
  string,
  { title: string; description: string; heading: string }
> = {
  "/about": {
    title: "About",
    heading: "About Manga Tracker",
    description:
      "Why Manga Tracker exists: compare what US stores charge for each manga volume, keep your place in every series, and see which ones have new volumes out.",
  },
  "/updates": {
    title: "What's new",
    heading: "What's new",
    description:
      "New on Manga Tracker: see new English volumes and chapters and next chapter dates. Email alerts are coming soon.",
  },
  "/acknowledgements": {
    title: "Acknowledgements",
    heading: "Acknowledgements",
    description:
      "The services behind Manga Tracker, the fonts it uses and how its affiliate links work.",
  },
};

const staticTags = (path: string): Tags | null => {
  const page = STATIC_PAGES[path];
  if (!page) return null;
  return {
    title: page.title,
    description: page.description,
    path,
    image: null,
    body: `<main class="crawl-page">
      ${crumbs([["/", SITE_NAME]])}
      <h1>${escapeHtml(page.heading)}</h1>
      <p>${escapeHtml(page.description)}</p>
      ${linkList(SITE_LINKS.filter(([href]) => href !== path))}
    </main>`,
  };
};

// the FAQ: every question and answer in the page a crawler reads, and as
// FAQPage markup (the same list the app's page shows: src/lib/content/faq.ts)
const faqTags = (): Tags => ({
  title: "FAQ",
  description: FAQ_DESCRIPTION,
  path: "/faq",
  image: null,
  jsonLd: faqJsonLd(),
  body: `<main class="crawl-page">
      ${crumbs([["/", SITE_NAME]])}
      <h1>Manga Tracker FAQ</h1>
      ${FAQ.map(
        (group) =>
          `<h2>${escapeHtml(group.name)}</h2>${group.questions
            .map(
              ({ q, a }) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`,
            )
            .join("")}`,
      ).join("")}
      ${linkList(SITE_LINKS.filter(([href]) => href !== "/faq"))}
    </main>`,
});

// the volumes someone owns, as the shared page counts them: their exact list
// when it has gaps, otherwise 1 up to the count
const ownedOf = (m: SharedShelf["manga"][number]) =>
  m.ownedList?.length
    ? m.ownedList
    : Array.from({ length: Math.max(0, m.volumesOwned ?? 0) }, (_, i) => i + 1);

// "1–3, 5, 8–10", as on the page
const ranges = (volumes: number[]) => {
  const out: string[] = [];
  const sorted = [...new Set(volumes)].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]!;
    while (sorted[i + 1] === sorted[i]! + 1) i++;
    out.push(start === sorted[i] ? `${start}` : `${start}–${sorted[i]}`);
  }
  return out.join(", ");
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

// someone's shelf, or one series on it (?series=, as the page opens it)
function shelfTags(
  shelf: SharedShelf,
  code: string,
  seriesName: string | undefined,
  origin: string,
): Tags {
  const owner = shelf.displayName;
  const path = `/u/${encodeURIComponent(code)}`;
  const one =
    seriesName &&
    shelf.manga.find((m) => m.name.toLowerCase() === seriesName.toLowerCase());
  if (one) {
    const owned = ownedOf(one);
    const where = one.status ? "finished" : one.planned ? "to read" : "reading";
    return {
      title: `${one.name} on ${owner}'s shelf`,
      description: owned.length
        ? `${owner} owns ${plural(owned.length, "volume")} of ${one.name} (Vol. ${ranges(owned)}), ${where}. See the rest of their manga shelf.`
        : `${one.name} is on ${owner}'s manga shelf, ${where}. See the rest of their shelf.`,
      path: `${path}?${new URLSearchParams({ series: one.name })}`,
      image: apiImage(one.image, origin),
      noindex: true,
      smallImage: true,
    };
  }
  const volumes = shelf.manga.reduce((n, m) => n + ownedOf(m).length, 0);
  // what they have most of says the most about the shelf
  const top = [...shelf.manga]
    .sort((a, b) => ownedOf(b).length - ownedOf(a).length)
    .slice(0, 3);
  return {
    title: `${owner}'s manga shelf`,
    description: clip(
      [
        `${plural(shelf.manga.length, "series", "series")}, ${plural(volumes, "volume")} owned.`,
        top.length ? `With ${top.map((m) => m.name).join(", ")}.` : "",
        "Track your own on Manga Tracker, free.",
      ]
        .filter(Boolean)
        .join(" "),
      // previews show about two lines; the invite at the end is worth them
      200,
    ),
    path,
    image: apiImage(top.find((m) => m.image)?.image ?? null, origin),
    noindex: true,
    smallImage: true,
  };
}

// swaps the default tags in index.html for the page's own
function render(
  {
    title,
    description,
    path,
    image,
    jsonLd,
    body,
    noindex,
    smallImage,
    fullTitle: asIs,
  }: Tags,
  origin: string,
) {
  const fullTitle = asIs ? title : `${title} | ${SITE_NAME}`;
  const url = origin + path;
  const tags = [
    `<title>${escapeHtml(fullTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    image && `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="${image && !smallImage ? "summary_large_image" : "summary"}" />`,
    noindex && `<meta name="robots" content="noindex" />`,
    // "<" escaped so a title can never close the script early
    jsonLd &&
      `<script id="page-jsonld" type="application/ld+json">${JSON.stringify(
        jsonLd,
      ).replace(/</g, "\\u003c")}</script>`,
    body && BODY_STYLE,
  ].filter(Boolean);

  return (
    template
      .replace(/<title>[\s\S]*?<\/title>\s*/, "")
      .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, "")
      .replace(/<meta\s+property="og:[^"]+"[\s\S]*?\/>\s*/g, "")
      .replace(/<meta\s+name="twitter:card"[\s\S]*?\/>\s*/, "")
      // a function, so a "$'" or "$&" in a title is kept as written rather than
      // read as a replace pattern
      .replace("</head>", () => `    ${tags.join("\n    ")}\n  </head>`)
      // createRoot replaces whatever is inside #root when the app starts
      .replace(
        '<div id="root"></div>',
        () => `<div id="root">${body ?? ""}</div>`,
      )
  );
}

// ---------- asking the API, briefly cached ----------

// `missing`: the API said the page's volume or series doesn't exist (404).
// Anything else it can't answer, it's treated as there, so a slow or broken
// API never tells search engines a real page is gone
type Summary<T> = { data: T | null; missing: boolean };
const cache = new Map<string, { at: number; answer: Summary<unknown> }>();

// `ip`: the visitor's, so the API's rate limit is per visitor (a crawler)
// rather than this one server for everyone
async function summary<T>(path: string, ip?: string): Promise<Summary<T>> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.answer as Summary<T>;
  const res = await fetch(API_URL + path, {
    // marks us as a crawler, so the API never spends a paid price refresh
    headers: {
      "User-Agent": "mangatracker-preview/1.0",
      ...(ip && { "X-Forwarded-For": ip }),
    },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const answer: Summary<T> = {
    // 204: it exists, with nothing stored to describe it yet
    data: res.status === 200 ? ((await res.json()) as T) : null,
    // 400: not even a valid ISBN or name, so there's no page either
    missing: res.status === 404 || res.status === 400,
  };
  // a body nobody reads still holds its connection: let it go
  if (res.status !== 200) await res.body?.cancel().catch(() => {});
  // only answers worth keeping: a failure is asked again next time
  if ([200, 204, 400, 404].includes(res.status)) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(path, { at: Date.now(), answer });
  }
  return answer;
}

// ---------- the server ----------

const app = express();
app.set("trust proxy", 1); // Railway's proxy, for the https:// in URLs
app.disable("x-powered-by");
// the visitor's own address, past Cloudflare (visitorIp.ts)
const ipOf = (req: Request) => visitorIp(req.ip, req.get("cf-connecting-ip"));

// what a browser is told about every page of the site itself. (/api answers
// carry the API's own headers.) No content policy yet: covers and scripts
// come from several hosts, and a wrong one blanks the page
app.use((_req, res, next) => {
  res.set({
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    // nobody else's page can put this site in a frame and trick a click
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
});

// The browser calls /api on this site; each request is streamed to the API
// and its answer streamed back (live price checks included). The forwarded
// headers tell the API the visitor's IP and that they're on https, so its
// secure session cookie is still set
app.use("/api", (req, res) => {
  if (!API_URL) {
    res.status(502).json({ error: [{ msg: "API_INTERNAL_URL isn't set" }] });
    return;
  }
  const target = new URL(req.originalUrl, API_URL);
  const client = target.protocol === "https:" ? https : http;
  const upstream = client.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        "x-forwarded-for": ipOf(req),
        "x-forwarded-proto": req.protocol,
        "x-forwarded-host": req.get("host") ?? "",
      },
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", (e) => {
    console.error(`API pass-through failed for ${req.originalUrl}:`, e.message);
    if (res.headersSent) res.destroy();
    else
      res.status(502).json({
        error: [{ msg: "The server isn't answering. Try again in a moment." }],
      });
  });
  req.pipe(upstream);
});

// The sitemap is made by the API, which knows every series and volume, but
// search engines trust a sitemap on the site's own domain most. So it's
// passed through here, and robots.txt points at this copy
// the last sitemap the API gave us, served whenever the API can't answer
// (mid-deploy, restarting, slow) so a crawler never reads an error
let lastSitemap: string | null = null;

async function fetchSitemap() {
  const upstream = await fetch(`${API_URL}/sitemap.xml`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!upstream.ok) throw new Error(`API responded ${upstream.status}`);
  const xml = await upstream.text();
  if (!xml.startsWith("<?xml") || !xml.includes("<urlset")) {
    throw new Error("API answered with something that isn't a sitemap");
  }
  lastSitemap = xml;
  return xml;
}

// before anything has worked: the pages every visitor can reach
const basicSitemap = (origin: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${["/", "/series", "/deals", "/faq", "/about", "/updates"].map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}
</urlset>
`;

app.get("/sitemap.xml", async (req, res) => {
  let xml: string;
  try {
    xml = await fetchSitemap();
  } catch (e) {
    console.error("sitemap pass-through failed:", (e as Error).message);
    xml = lastSitemap ?? basicSitemap(`${req.protocol}://${req.get("host")}`);
  }
  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=3600")
    .send(xml);
});

// have a copy ready from the start
if (API_URL) fetchSitemap().catch(() => {});

// the built robots.txt names the API's sitemap; this one names ours
const robots = readFileSync(`${DIST}robots.txt`, "utf8").replace(
  /^Sitemap:.*$/m,
  "",
);
app.get("/robots.txt", (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send(`${robots.trimEnd()}
Sitemap: ${origin}/sitemap.xml
`);
});

// hashed build files never change; everything else is checked each time
app.use(
  "/assets",
  express.static(`${DIST}assets`, { immutable: true, maxAge: "1y" }),
);
app.use(express.static(DIST, { index: false, maxAge: 0 }));

const sendPage = (res: Response, html: string) =>
  res.set("Cache-Control", "no-cache").type("html").send(html);

// the page's own tags when we can get them; the plain app if not. A page
// whose volume or series doesn't exist still shows the app (it says so), but
// with a real 404, so search engines don't index it as a page
const withTags =
  (
    load: (req: Request, origin: string) => Promise<Tags | "missing" | null>,
    redirectTo = false,
  ) =>
  async (req: Request, res: Response) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      const tags = API_URL ? await load(req, origin) : null;
      // a volume under an old or ISBN-only address: a permanent redirect to
      // its own, rather than the app swapping the address in the browser
      if (redirectTo && tags && tags !== "missing" && req.path !== tags.path) {
        const query = req.originalUrl.slice(req.path.length);
        res.redirect(301, tags.path + query);
        return;
      }
      if (tags === "missing") res.status(404);
      sendPage(
        res,
        tags && tags !== "missing" ? render(tags, origin) : template,
      );
    } catch (e) {
      console.error(
        `preview tags failed for ${req.originalUrl}:`,
        (e as Error).message,
      );
      sendPage(res, template);
    }
  };

app.get(
  "/prices/series/:slug",
  withTags(async (req, origin) => {
    const name =
      (typeof req.query.name === "string" && req.query.name) ||
      String(req.params.slug).replace(/-/g, " ");
    const { data, missing } = await summary<SeriesSummary>(
      `/api/prices/summary/series?${new URLSearchParams({ name })}`,
      ipOf(req),
    );
    if (missing) return "missing";
    if (data) {
      const tags = seriesTags(data, origin);
      // a series whose anime we can answer for links to that page
      const anime = await summary<AfterAnime>(
        `/api/after-anime?${new URLSearchParams({ name: data.name })}`,
        ipOf(req),
      ).catch(() => ({ data: null }));
      if (anime.data?.stops.length && tags.body)
        tags.body = tags.body.replace(
          "</main>",
          () =>
            `<p><a href="${escapeHtml(afterAnimeShowPath(data.name))}">${escapeHtml(showQuestion(data.name))}</a></p></main>`,
        );
      return tags;
    }
    // nothing stored to describe it: a made-up name, or a series nobody has
    // opened yet. Not indexed, so a made-up one never counts as a page (a
    // "soft 404"); a real one gets its tags once someone opens it
    return {
      title: "Manga prices",
      description: HOME_DESCRIPTION.replace(/&#39;/g, "'").replace(
        /&amp;/g,
        "&",
      ),
      path: req.path,
      image: null,
      noindex: true,
    };
  }),
);

app.get(
  "/prices/:isbn{/:slug}",
  withTags(async (req, origin) => {
    const isbn = String(req.params.isbn);
    if (!/^[\dXx-]{10,17}$/.test(isbn)) return "missing";
    const { data, missing } = await summary<VolumeSummary>(
      `/api/prices/summary/volume/${encodeURIComponent(isbn)}`,
      ipOf(req),
    );
    if (missing) return "missing";
    return data && volumeTags(data, origin);
  }, true),
);

// a shared shelf: a link preview with their name and what's on it. Not
// shared (or never was): the plain app, which says so
app.get(
  "/u/:code",
  withTags(async (req, origin) => {
    const code = String(req.params.code);
    if (!/^[\w-]{4,40}$/.test(code)) return null;
    const { data } = await summary<SharedShelf>(
      `/api/share/${encodeURIComponent(code)}`,
      ipOf(req),
    );
    const series =
      typeof req.query.series === "string" ? req.query.series : undefined;
    return data && shelfTags(data, code, series, origin);
  }),
);

// the home page and the full series list: their own tags and a body of
// links. A page of the list (?page=2) or a filter is the plain app, which
// sets its own canonical
app.get(
  "/",
  withTags(async (req) => {
    const { data } = await summary<Highlights>(
      "/api/prices/highlights",
      ipOf(req),
    ).catch(() => ({ data: null }));
    return homeTags(data);
  }),
);

app.get(
  "/series",
  withTags(async (req) => {
    if (Object.keys(req.query).length) return null;
    const { data } = await summary<SeriesIndexEntry[]>(
      "/api/prices/series-index",
      ipOf(req),
    );
    return Array.isArray(data) ? seriesIndexTags(data) : null;
  }),
);

app.get(
  "/deals",
  withTags(async (req) => {
    const { data } = await summary<{ deals: Deal[] }>(
      "/api/prices/deals",
      ipOf(req),
    );
    return dealsTags(data?.deals ?? []);
  }),
);

app.get(
  "/after-the-anime",
  withTags(async (req) => {
    const { data } = await summary<AfterAnimeShow[]>(
      "/api/after-anime/index",
      ipOf(req),
    );
    return afterAnimeIndexTags(Array.isArray(data) ? data : []);
  }),
);

app.get(
  "/after-the-anime/:slug",
  withTags(async (req, origin) => {
    // the owner's review page is the plain app
    if (req.params.slug === "review") return null;
    const name =
      (typeof req.query.name === "string" && req.query.name) ||
      String(req.params.slug).replace(/-/g, " ");
    const { data, missing } = await summary<AfterAnime>(
      `/api/after-anime?${new URLSearchParams({ name })}`,
      ipOf(req),
    );
    if (missing) return "missing";
    if (!data) return null;
    // the other shows, for the links at its foot; the page is whole without
    const others = await summary<AfterAnimeShow[]>(
      "/api/after-anime/index",
      ipOf(req),
    ).catch(() => ({ data: null }));
    return afterAnimeTags(
      data,
      Array.isArray(others.data) ? others.data : [],
      origin,
    );
  }),
);

app.get(
  "/faq",
  withTags(async () => faqTags()),
);

app.get(
  Object.keys(STATIC_PAGES),
  withTags(async (req) => staticTags(req.path)),
);

// every other address is the single-page app, as `serve -s` did. One that
// isn't a page shows the app's not-found page, with a real 404
app.get("/{*path}", (req, res) => {
  if (!isAppPage(req.path)) res.status(404);
  sendPage(res, template);
});

app.listen(PORT, () => {
  console.log(`site on http://localhost:${PORT}`);
});
