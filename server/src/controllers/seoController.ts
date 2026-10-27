// The sitemap and the API's robots.txt. The sitemap is built here because
// only the API knows every series and volume; the site's own server
// (client/server.ts) passes it through on the main domain. Links point at
// the site, never at the API.
import type { Request, Response } from "express";
import config from "../config/config.js";
import priceQueries from "../models/priceQueries.js";
import { slugify } from "../prices/match.js";

const site = () => config.CLIENT_URL?.replace(/\/+$/, "");

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!);

// the same addresses the pages name as their canonical ones
const seriesPath = (name: string) => `/prices/series/${slugify(name)}`;
const volumePath = (isbn13: string, title: string) => {
  const slug = title ? slugify(title) : "";
  return slug ? `/prices/${isbn13}/${slug}` : `/prices/${isbn13}`;
};

const entry = (path: string, lastmod?: Date | null) =>
  `  <url><loc>${escapeXml(site() + path)}</loc>${
    lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ""
  }</url>`;

const sitemap = async (_req: Request, res: Response) => {
  if (!site()) {
    res.status(503).send("CLIENT_URL isn't set");
    return;
  }
  const { volumes, series } = await priceQueries.getSitemapEntries();
  const urls = [
    entry("/"),
    entry("/about"),
    entry("/series"),
    ...series.map((s) => entry(seriesPath(s.name), s.fetchedAt)),
    ...volumes.map((v) => entry(volumePath(v.isbn13.trim(), v.title), v.updated)),
  ];
  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=3600")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    );
};

// this host is the API, not the site: keep crawlers to the sitemap and the
// cover images the site's pages show
const robots = (_req: Request, res: Response) => {
  res
    .type("text/plain")
    .send(
      "User-agent: *\nAllow: /sitemap.xml\nAllow: /api/prices/cover/\nDisallow: /\n",
    );
};

export default { sitemap, robots };
