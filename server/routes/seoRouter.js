import { Router } from "express";
import priceQueries from "../models/priceQueries.js";
import { slugify } from "../prices/anilist.js";

// The sitemap lives here because the site itself is static files; the
// site's robots.txt points search engines at it (a cross-host sitemap,
// allowed when robots.txt names it). Pages link to the site, not to us.
export const seoRouter = Router();

const site = () => process.env.CLIENT_URL?.replace(/\/+$/, "");

const escapeXml = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );

// the same addresses the pages name as their canonical ones
const seriesPath = (name) => `/prices/series/${slugify(name)}`;
const volumePath = (isbn13, title) => {
  const slug = title ? slugify(title) : "";
  return slug ? `/prices/${isbn13}/${slug}` : `/prices/${isbn13}`;
};

const entry = (path, lastmod) =>
  `  <url><loc>${escapeXml(site() + path)}</loc>${
    lastmod
      ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
      : ""
  }</url>`;

seoRouter.get("/sitemap.xml", async (req, res) => {
  if (!site()) {
    res.status(503).send("CLIENT_URL isn't set");
    return;
  }
  const { volumes, series } = await priceQueries.getSitemapEntries();
  const urls = [
    entry("/"),
    entry("/about"),
    ...series.map((s) => entry(seriesPath(s.name), s.fetched_at)),
    ...volumes.map((v) =>
      entry(volumePath(v.isbn13.trim(), v.title), v.updated),
    ),
  ];
  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=3600")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    );
});

// this host is the API, not the site: keep crawlers to the sitemap and the
// cover images the site's pages show
seoRouter.get("/robots.txt", (req, res) => {
  res
    .type("text/plain")
    .send(
      "User-agent: *\nAllow: /sitemap.xml\nAllow: /api/prices/cover/\nDisallow: /\n",
    );
});
