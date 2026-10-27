// Public price checker endpoints: no account needed. Upstream failures
// (Open Library, AniList, stores) become 502s with a friendly message, so
// pages can show "try again" instead of a blank error.
import type { Request, Response } from "express";
import { matchedData, param, query } from "express-validator";
import { NotFoundError, UpstreamError } from "../errors/AppError.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { searchVolumes, toIsbn13 } from "../prices/catalog.js";
import {
  CoverLookupPaused,
  coverImageUrl,
  editionCoverId,
  isbnCoverImageUrl,
} from "../prices/covers.js";
import { isCrawler } from "../prices/crawlers.js";
import {
  getHighlights,
  getSeries,
  getSeriesIndex,
  getSeriesSummary,
  getVolumePrices,
  getVolumeSummary,
  searchSeries,
} from "../prices/service.js";

// ---------- shared rules ----------

// :isbn may be ISBN-10 or -13 with dashes; handlers always get an ISBN-13
const isbnParam = [
  param("isbn")
    .customSanitizer(toIsbn13)
    .custom((v) => v !== null)
    .withMessage("That isn't a valid ISBN"),
  rejectInvalid,
];

const searchQuery = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search for at least 2 characters"),
  rejectInvalid,
];

const seriesName = [
  query("name").trim().isLength({ min: 2, max: 120 }).withMessage("Which series?"),
  rejectInvalid,
];

// runs an upstream call, turning its failure into a 502 with `message`
async function upstream<T>(what: string, message: string, run: () => Promise<T>) {
  try {
    return await run();
  } catch (e) {
    console.error(`${what} failed:`, e);
    throw new UpstreamError(message);
  }
}

const CACHE_10_MIN = "public, max-age=600";

// ---------- handlers ----------

// GET /search?q=  volumes by title, author or ISBN
const search = [
  ...searchQuery,
  async (req: Request, res: Response) => {
    const results = await upstream(
      "volume search",
      "The book catalog didn't answer. Try again in a moment.",
      () => searchVolumes(matchedData(req).q),
    );
    res.json({ results });
  },
];

// GET /series-search?q=  the typeahead
const seriesSearch = [
  ...searchQuery,
  async (req: Request, res: Response) => {
    const results = await upstream(
      "series search",
      "Series search didn't answer. Try again in a moment.",
      () => searchSeries(matchedData(req).q),
    );
    res.json({ results });
  },
];

// GET /:isbn  a volume's prices. Crawlers see stored prices only
const volume = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    const data = await upstream(
      "price lookup",
      "Prices couldn't be loaded. Try again in a moment.",
      () =>
        getVolumePrices(matchedData(req).isbn, {
          refresh: !isCrawler(req.get("user-agent")),
        }),
    );
    if (!data) throw new NotFoundError("We couldn't find that volume.");
    res.json(data);
  },
];

// GET /series?name=  every volume of a series
const series = [
  ...seriesName,
  async (req: Request, res: Response) => {
    const data = await upstream(
      "series lookup",
      "That series couldn't be loaded. Try again in a moment.",
      () => getSeries(matchedData(req).name),
    );
    if (!data) throw new NotFoundError("We couldn't find that series.");
    res.json(data);
  },
];

// GET /highlights  the home page rows
const highlights = async (_req: Request, res: Response) => {
  res.json(
    await upstream("highlights", "Couldn't load highlights.", getHighlights),
  );
};

// GET /series-index  the /series page
const seriesIndex = async (_req: Request, res: Response) => {
  res.set("Cache-Control", CACHE_10_MIN).json(await getSeriesIndex());
};

// GET /cover/:isbn?size=M|L  redirects to the edition's cover image
const cover = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    const { isbn } = matchedData(req);
    const size = req.query.size === "L" ? "L" : "M";
    try {
      const id = await editionCoverId(isbn);
      if (!id) {
        // no cover for this edition: the page shows its drawn placeholder
        res.set("Cache-Control", "public, max-age=86400").sendStatus(404);
        return;
      }
      res.set("Cache-Control", "public, max-age=604800");
      res.redirect(302, coverImageUrl(id, size));
    } catch (e) {
      if (!(e instanceof CoverLookupPaused)) {
        console.error("cover lookup failed:", (e as Error).message);
      }
      // Open Library's API is out of reach, but its image host usually
      // isn't: send the browser to the by-ISBN image. That one is limited
      // per visitor rather than per server, so it's fine as a stopgap.
      // Never cached, so the next visit gets the by-ID image again
      res.set("Cache-Control", "no-store");
      res.redirect(302, isbnCoverImageUrl(isbn, size));
    }
  },
];

// GET /summary/volume/:isbn  for the site's link-preview server; DB only
const volumeSummary = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    const data = await getVolumeSummary(matchedData(req).isbn);
    if (!data) throw new NotFoundError();
    res.set("Cache-Control", CACHE_10_MIN).json(data);
  },
];

// GET /summary/series?name=  same, for series pages
const seriesSummary = [
  ...seriesName,
  async (req: Request, res: Response) => {
    const data = await getSeriesSummary(matchedData(req).name);
    if (!data) throw new NotFoundError();
    res.set("Cache-Control", CACHE_10_MIN).json(data);
  },
];

export default {
  search,
  seriesSearch,
  volume,
  series,
  highlights,
  seriesIndex,
  cover,
  volumeSummary,
  seriesSummary,
};
