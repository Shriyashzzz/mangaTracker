// Public price checker endpoints: no account needed. Upstream failures
// (Open Library, AniList, stores) become 502s with a friendly message, so
// pages can show "try again" instead of a blank error.
import { findNovelsFor } from "../prices/novelFinder.js";
import { baseName } from "../prices/lightNovel.js";
import type { Request, Response } from "express";
import { matchedData, param, query } from "express-validator";
import { NotFoundError, UpstreamError } from "../errors/AppError.js";
import { rejectInvalid } from "../middlewares/validate.js";
import { sendError } from "../middlewares/errorHandler.js";
import { searchVolumes, toIsbn13 } from "../prices/sources/catalog.js";
import {
  CoverLookupPaused,
  coverImageUrl,
  editionCoverId,
  isbnCoverImageUrl,
} from "../prices/sources/covers.js";
import { isCrawler } from "../prices/crawlers.js";
import { isHuman } from "../prices/human.js";
import { asSpender, spenderOf } from "../prices/spender.js";
import { getCanadaPrices } from "../prices/canada/canadaPrices.js";
import {
  getHighlights,
  getSeries,
  getSeriesIndex,
  getSeriesSummary,
  getVolumePrices,
  getVolumeSummary,
  lookupScannedIsbn,
  searchSeries,
  volumeExists,
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
  query("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Which series?"),
  rejectInvalid,
];

// runs an upstream call, turning its failure into a 502 with `message`
async function upstream<T>(
  what: string,
  message: string,
  run: () => Promise<T>,
) {
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
    // after answering: the top few manga with no novel shown get checked for
    // one AniList doesn't list, so a later search can show it
    const novels = new Set(
      results
        .filter((r) => r.lightNovel)
        .map((r) => baseName(r.name).toLowerCase()),
    );
    findNovelsFor(
      results
        .filter((r) => !r.lightNovel && !novels.has(r.name.toLowerCase()))
        .slice(0, 3)
        .map((r) => r.name),
    );
  },
];

// GET /:isbn  a volume's prices. Crawlers see stored prices only
const volume = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    // a live check (paid searches) only for a page that passed Turnstile
    const live =
      !isCrawler(req.get("user-agent")) &&
      req.query.stored !== "1" &&
      (await isHuman(req.query.human, req.ip));
    const data = await upstream(
      "price lookup",
      "Prices couldn't be loaded. Try again in a moment.",
      // any search it spends goes on this visitor's count
      () =>
        asSpender(spenderOf(req), () =>
          getVolumePrices(matchedData(req).isbn, {
            // ?stored=1: someone looking at Canadian prices, who won't see these
            refresh: live,
          }),
        ),
    );
    if (!data) throw new NotFoundError("We couldn't find that volume.");
    res.json(data);
  },
];

// GET /scan/:isbn  a scanned barcode: its series and volume, for the shelf.
// Free sources only, never a price search
const scan = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    const book = await upstream(
      "barcode lookup",
      "The book catalog didn't answer. Try again in a moment.",
      () => lookupScannedIsbn(matchedData(req).isbn),
    );
    if (!book) throw new NotFoundError("We couldn't find that book.");
    res.json(book);
  },
];

// GET /ca/:isbn  a volume's Canadian prices (sandboxed in prices/canada).
// Never throws for a store problem: it answers with the store links instead
const canadaVolume = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    const live =
      !isCrawler(req.get("user-agent")) &&
      (await isHuman(req.query.human, req.ip));
    res.json(
      await upstream(
        "Canadian price lookup",
        "Canadian prices couldn't be loaded. Try again in a moment.",
        () =>
          asSpender(spenderOf(req), () =>
            getCanadaPrices(matchedData(req).isbn, {
              refresh: live,
            }),
          ),
      ),
    );
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
        res.set("Cache-Control", "public, max-age=86400");
        sendError(res, 404, "This edition has no cover.");
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
    const { isbn } = matchedData(req);
    const data = await getVolumeSummary(isbn);
    if (data) return res.set("Cache-Control", CACHE_10_MIN).json(data);
    // nothing stored yet, but the page would still find it: no tags to give,
    // yet it isn't missing (204). Only a book no one can find is a 404
    if (await volumeExists(isbn)) return res.sendStatus(204);
    throw new NotFoundError();
  },
];

// GET /summary/series?name=  same, for series pages
const seriesSummary = [
  ...seriesName,
  async (req: Request, res: Response) => {
    const { name } = matchedData(req);
    const data = await getSeriesSummary(name);
    if (data) return res.set("Cache-Control", CACHE_10_MIN).json(data);
    // the same lookup the series page makes (free catalogs only). A catalog
    // that's down throws, which is never "missing"
    if (await getSeries(name)) return res.sendStatus(204);
    throw new NotFoundError();
  },
];

export default {
  scan,
  canadaVolume,
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
