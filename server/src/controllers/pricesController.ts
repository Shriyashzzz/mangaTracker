// Public price checker endpoints: no account needed. Upstream failures
// (Open Library, AniList, stores) become 502s with a friendly message, so
// pages can show "try again" instead of a blank error.
import { isNovelName } from "../prices/lightNovel.js";
import priceQueries from "../models/priceQueries.js";
import type { CatalogBook } from "../prices/types.js";
import { editionLinesOf } from "../prices/editionSource.js";
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
  fallbackCover,
  isbnCoverImageUrl,
} from "../prices/sources/covers.js";
import { isCrawler } from "../prices/crawlers.js";
import { isHuman } from "../prices/human.js";
import { asSpender, spenderOf } from "../prices/spender.js";
import { getCanadaPrices } from "../prices/canada/canadaPrices.js";
import {
  getDealsPage,
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
    const crawler = isCrawler(req.get("user-agent"));
    const live =
      !crawler &&
      req.query.stored !== "1" &&
      (await isHuman(req.query.human, req.ip));
    const data = await upstream(
      "price lookup",
      "Prices couldn't be loaded. Try again in a moment.",
      // any search it spends goes on this visitor's count
      () =>
        asSpender(spenderOf(req), () =>
          getVolumePrices(matchedData(req).isbn, {
            // ?stored=1: what's stored, never a refresh. Every volume page asks
            // this first (and it's all a Canadian viewer gets)
            refresh: live,
            report: !crawler,
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

// GET /editions?name=  the series' omnibus and deluxe lines, book by book,
// each with its last known price where it has one. Free sources only
const editions = [
  ...seriesName,
  async (req: Request, res: Response) => {
    const name: string = matchedData(req).name;
    // a light novel has no omnibus lines of the manga's
    if (isNovelName(name)) return void res.json({ lines: [] });
    const data = await getSeries(name).catch(() => null);
    const lines = await editionLinesOf(
      data?.name ?? name,
      (data?.volumes ?? []) as unknown as CatalogBook[],
    );
    const known = await priceQueries
      .getKnownPrices(
        lines.flatMap((l) => l.books.flatMap((b) => b.isbn13 ?? [])),
      )
      .catch(() => new Map<string, { priceCents: number }>());
    res.set("Cache-Control", "private, max-age=300").json({
      lines: lines.map((line) => ({
        ...line,
        books: line.books.map((b) => ({
          ...b,
          knownPriceCents:
            (b.isbn13 && known.get(b.isbn13)?.priceCents) || null,
        })),
      })),
    });
  },
];

// GET /highlights  the home page rows
const highlights = async (_req: Request, res: Response) => {
  res.json(
    await upstream("highlights", "Couldn't load highlights.", getHighlights),
  );
};

// GET /deals  the /deals page: volumes now well under their usual price.
// Stored prices only, so it never sets off a check
const deals = async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=300").json({
    deals: await upstream("deals", "Couldn't load deals.", getDealsPage),
  });
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
      // none on Open Library: Google Books' cover of this edition, if it has
      // one (and today's lookups allow)
      // A crawler gets one already found, never spends a new lookup
      const fallback = id
        ? null
        : await fallbackCover(isbn, {
            ask: !isCrawler(req.get("user-agent")),
          }).catch((e: Error) => {
            console.error("fallback cover failed:", e.message);
            return null;
          });
      if (!id && !fallback) {
        // no cover for this edition: the page shows its drawn placeholder.
        // Kept a day only when we know there's none; when we didn't ask (a
        // crawler, today's lookups used up), never kept, or a cache would
        // hand the next visitor "no cover" too
        res.set(
          "Cache-Control",
          fallback === null ? "public, max-age=86400" : "no-store",
        );
        sendError(res, 404, "This edition has no cover.");
        return;
      }
      // the image itself, from this site: no chain of redirects for search
      // engines to give up on, and the covers count as this site's in image
      // search. Cloudflare keeps it (a Cache Rule on /api/prices/cover/)
      await sendImage(res, fallback ?? coverImageUrl(id!, size));
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

// a cover image passed on as it came, kept 30 days by browsers and
// Cloudflare. Anything that isn't an image (a host's error page) throws, and
// the route falls back to sending the browser there itself
const COVER_FETCH_MS = 10_000;
const COVER_TYPES = /^image\/(jpeg|png|webp|gif|avif)\b/i;
const COVER_MAX_BYTES = 8 * 1024 * 1024;
async function sendImage(res: Response, url: string) {
  const upstream = await fetch(url, {
    signal: AbortSignal.timeout(COVER_FETCH_MS),
  });
  const type = upstream.headers.get("content-type") ?? "";
  // pictures only, never an SVG (it can carry script, and this is our own
  // address), and nothing huge
  if (!upstream.ok || !upstream.body || !COVER_TYPES.test(type))
    throw new Error(`cover image answered ${upstream.status} ${type}`);
  const image = Buffer.from(await upstream.arrayBuffer());
  if (image.length > COVER_MAX_BYTES)
    throw new Error(`cover image is ${image.length} bytes`);
  res.set({
    "Content-Type": type,
    "Cache-Control": "public, max-age=2592000",
  });
  res.end(image);
}

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
    // nothing stored to describe it: not "missing" either. Finding out would
    // take the series page's whole catalog lookup, which crawlers sending
    // made-up names would turn into a flood of Open Library searches
    return res.sendStatus(204);
  },
];

export default {
  scan,
  editions,
  canadaVolume,
  search,
  seriesSearch,
  volume,
  series,
  highlights,
  deals,
  seriesIndex,
  cover,
  volumeSummary,
  seriesSummary,
};
