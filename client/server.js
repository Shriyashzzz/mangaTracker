// Serves the built site (dist/) in production, in place of `serve -s dist`.
// Same files, same single-page fallback, plus one thing static hosting can't
// do: for volume and series pages it writes that page's title, description,
// preview image and structured data into index.html before sending it. Link
// previews (Discord, iMessage, X, WhatsApp) and crawlers that don't run
// JavaScript only ever see this first HTML. The React app then takes over
// and keeps these tags up to date as people move around, as before.
//
import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("./dist/", import.meta.url));
const API_URL = process.env.VITE_API_URL?.replace(/\/+$/, "");
const PORT = process.env.PORT || 3000;
// a preview that takes longer than this isn't worth holding the page for
const API_TIMEOUT_MS = 2500;
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 1000;

const SITE_NAME = "Manga Tracker";
const template = readFileSync(`${DIST}index.html`, "utf8");

// ---------- the tags, matching client/src/lib/seo.js ----------

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const clip = (text, max = 155) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const usd = (cents) => `$${(cents / 100).toFixed(2)}`;
const apiImage = (url) => (url?.startsWith("/api/") ? API_URL + url : url);

const volumePath = (isbn13, title) => {
  const slug = title ? slugify(title) : "";
  return slug ? `/prices/${isbn13}/${slug}` : `/prices/${isbn13}`;
};
const seriesPath = (name) => `/prices/series/${slugify(name)}`;

function volumeTags(v, origin) {
  const path = volumePath(v.isbn13, v.title);
  const description = clip(
    [
      `Compare US prices for ${v.title}`,
      v.stores.length
        ? `at ${v.stores.slice(0, 4).join(", ")} and more.`
        : "across stores.",
      v.bestNew
        ? `Lowest new price we've found: ${usd(v.bestNew.priceCents)} at ${v.bestNew.store}.`
        : "",
      v.publisher ? `Published by ${v.publisher}.` : "",
    ].join(" "),
  );
  const image = apiImage(v.coverUrl) ?? v.seriesCoverUrl;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Book", "Product"],
    name: v.title,
    isbn: v.isbn13,
    gtin13: v.isbn13,
    url: origin + path,
    ...(image && { image }),
    ...(v.authors && { author: { "@type": "Person", name: v.authors } }),
    ...(v.publisher && {
      publisher: { "@type": "Organization", name: v.publisher },
      brand: { "@type": "Brand", name: v.publisher },
    }),
    ...(v.year && { datePublished: String(v.year) }),
    isPartOf: { "@type": "BookSeries", name: v.seriesName },
    ...(v.offerCount && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: (v.lowCents / 100).toFixed(2),
        highPrice: (v.highCents / 100).toFixed(2),
        offerCount: v.offerCount,
      },
    }),
  };
  return {
    title: `${v.title} price comparison`,
    description,
    path,
    image,
    jsonLd,
  };
}

function seriesTags(s, origin) {
  const path = seriesPath(s.name);
  return {
    title: `${s.name} manga prices`,
    description: clip(
      `Compare US prices for every ${s.name} volume in English. ${s.description ?? ""}`,
    ),
    path,
    image: s.coverUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BookSeries",
      name: s.name,
      url: origin + path,
      ...(s.description && { description: clip(s.description, 300) }),
      ...(s.coverUrl && { image: s.coverUrl }),
      ...(s.genres?.length && { genre: s.genres }),
    },
  };
}

// swaps the default tags in index.html for the page's own
function render({ title, description, path, image, jsonLd }, origin) {
  const fullTitle = `${title} | ${SITE_NAME}`;
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
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    // "<" escaped so a title can never close the script early
    `<script id="page-jsonld" type="application/ld+json">${JSON.stringify(
      jsonLd,
    ).replace(/</g, "\\u003c")}</script>`,
  ].filter(Boolean);

  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, "")
    .replace(/<meta\s+property="og:[^"]+"[\s\S]*?\/>\s*/g, "")
    .replace(/<meta\s+name="twitter:card"[\s\S]*?\/>\s*/, "")
    .replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}

// ---------- asking the API, briefly cached ----------

const cache = new Map();

async function summary(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const res = await fetch(API_URL + path, {
    // marks us as a crawler, so the API never spends a paid price refresh
    headers: { "User-Agent": "mangatracker-preview/1.0" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const data = res.ok ? await res.json() : null;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(path, { at: Date.now(), data });
  return data;
}

// ---------- the server ----------

const app = express();
app.set("trust proxy", 1); // Railway's proxy, for the https:// in URLs
app.disable("x-powered-by");

// The sitemap is made by the API, which knows every series and volume, but
// search engines trust a sitemap on the site's own domain most. So it's
// passed through here, and robots.txt points at this copy
app.get("/sitemap.xml", async (req, res) => {
  try {
    const upstream = await fetch(`${API_URL}/sitemap.xml`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`API responded ${upstream.status}`);
    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(await upstream.text());
  } catch (e) {
    console.error("sitemap pass-through failed:", e.message);
    res.sendStatus(502);
  }
});

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

const sendPage = (res, html) =>
  res.set("Cache-Control", "no-cache").type("html").send(html);

// the page's own tags when we can get them; the plain app if not
const withTags = (load) => async (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  try {
    const tags = API_URL ? await load(req, origin) : null;
    sendPage(res, tags ? render(tags, origin) : template);
  } catch (e) {
    console.error(`preview tags failed for ${req.originalUrl}:`, e.message);
    sendPage(res, template);
  }
};

app.get(
  "/prices/series/:slug",
  withTags(async (req, origin) => {
    const name = req.query.name || req.params.slug.replace(/-/g, " ");
    const data = await summary(
      `/api/prices/summary/series?${new URLSearchParams({ name })}`,
    );
    return data && seriesTags(data, origin);
  }),
);

app.get(
  "/prices/:isbn{/:slug}",
  withTags(async (req, origin) => {
    if (!/^[\dXx-]{10,17}$/.test(req.params.isbn)) return null;
    const data = await summary(
      `/api/prices/summary/volume/${encodeURIComponent(req.params.isbn)}`,
    );
    return data && volumeTags(data, origin);
  }),
);

// every other address is the single-page app, as `serve -s` did
app.get("/{*path}", (req, res) => sendPage(res, template));

app.listen(PORT, () => {
  console.log(`site on http://localhost:${PORT}`);
});
