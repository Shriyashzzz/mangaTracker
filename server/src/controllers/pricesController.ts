// Public price checker endpoints: no account needed. Upstream failures
// (Open Library, AniList, stores) become 502s with a friendly message, so
// pages can show "try again" instead of a blank error.
import { countScan, roomFor } from "../plan/plan.js";
import { nearSeriesNames } from "../prices/seriesNames.js";
import { slugify } from "../prices/stores/match.js";
import { closeEnough } from "../util/shelf/spelling.js";
import { scanBoxSets } from "../prices/boxSetScan.js";
import { isNovelName } from "../prices/lightNovel.js";
import priceQueries, { countryOf } from "../models/priceQueries.js";
import type { CatalogBook } from "../prices/types.js";
import { editionLinesOf } from "../prices/editionSource.js";
import { findNovelsFor } from "../prices/novelFinder.js";
import { baseName } from "../prices/lightNovel.js";
import type { Request, Response } from "express";
import { matchedData, param, query } from "express-validator";
import { NotFoundError, UpstreamError } from "../errors/AppError.js";
import { rejectInvalid } from "../middlewares/validate.js";
import userQueries from "../models/userQueries.js";
import { MOST_COVERS, shelfCard } from "../util/shelf/shelfCard.js";
import { topOf } from "../util/shelf/shareTop.js";
import { sendError } from "../middlewares/errorHandler.js";
import { searchVolumes, toIsbn13 } from "../prices/sources/catalog.js";
import {
  CoverLookupPaused,
  anilistSources,
  coverImageUrl,
  editionCoverId,
  fallbackCover,
  googleCoverAt,
  isbnCoverImageUrl,
} from "../prices/sources/covers.js";
import {
  COVER_WIDTHS,
  allowedWidth,
  isBlankPage,
  isCoverShaped,
  resizeCover,
  type CoverWidth,
} from "../prices/sources/coverResizer.js";
import { englishCoverIsbn } from "../prices/sources/englishCover.js";
import { isCrawler } from "../prices/crawlers.js";
import { learnAnimeAnswer } from "../prices/afterAnime/afterAnime.js";
import { isHuman } from "../prices/human.js";
import { asSpender, spenderOf } from "../prices/spender.js";
import { getCanadaPrices } from "../prices/canada/canadaPrices.js";
import {
  getDealsPage,
  getHighlights,
  getPricedCount,
  getSeries,
  getSeriesIndex,
  getEditionsIndex,
  getSeriesSummary,
  getVolumePrices,
  getVolumeSummary,
  lookupScannedIsbn,
  searchSeries,
  volumeExists,
} from "../prices/service.js";
import { clientIp } from "../util/clientIp.js";

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
    .isLength({ min: 2 })
    .withMessage("Search for at least 2 characters")
    .isLength({ max: 100 })
    .withMessage("Searches can be up to 100 characters"),
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

// GET /series-near?q=  a typo AniList found nothing for: the known series
// names it's a slip or two from ("chainsw man": Chainsaw Man). From the
// names the site already keeps, in memory: no API is called
const seriesNear = [
  ...searchQuery,
  async (req: Request, res: Response) => {
    res.json({ names: await nearSeriesNames(matchedData(req).q) });
  },
];

// GET /series-search?q=  the typeahead. &popular=true: the most read first
// (a typo's retry by one of its words)
const seriesSearch = [
  query("popular").optional().isBoolean().toBoolean(),
  ...searchQuery,
  async (req: Request, res: Response) => {
    const { q, popular } = matchedData(req);
    const results = await upstream(
      "series search",
      "Series search didn't answer. Try again in a moment.",
      () => searchSeries(q, Boolean(popular)),
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
      (await isHuman(req.query.human, clientIp(req)));
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
            // the rest of the series' prices, in their country
            country: countryOf(req.query.country),
          }),
        ),
    );
    if (!data) throw new NotFoundError("We couldn't find that volume.");
    // a person opened it: the background keeps its prices fresh sooner
    if (!crawler)
      void priceQueries.noteOpened(matchedData(req).isbn).catch(() => {});
    res.json(data);
  },
];

// GET /scan/:isbn  a scanned barcode: its series and volume, for the shelf.
// Free sources only, never a price search
const scan = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    // a signed-in reader's scans are counted; a free account has so many
    const userId = req.session.userId;
    if (userId && !(await roomFor(req, res, "scans"))) return;
    const book = await upstream(
      "barcode lookup",
      "The book catalog didn't answer. Try again in a moment.",
      // signed in or not: their own answer to "which volumes are in this
      // book?" comes first when they've given one
      () => lookupScannedIsbn(matchedData(req).isbn, req.session.userId),
    );
    if (!book) throw new NotFoundError("We couldn't find that book.");
    if (userId) await countScan(userId);
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
      (await isHuman(req.query.human, clientIp(req)));
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
// a name that came only from a page's address (/prices/series/zz-not-a-series)
// has to be one of the series' names, give or take a slip, or spelled the same
// as one: AniList's best guess for made-up words is some real series
// ("Kidou Senshi Gundam ZZ"). Names sent from a link or a shelf aren't held
// to this ("Berserk Deluxe" is still Berserk)
const fitsAddress = (
  asked: string,
  info: { name: string; altNames?: string[] },
) =>
  [info.name, ...(info.altNames ?? [])].some(
    (name) => slugify(name) === slugify(asked) || closeEnough(asked, name),
  );

const series = [
  query("strict").optional().isBoolean().toBoolean(),
  ...seriesName,
  async (req: Request, res: Response) => {
    const { name, strict } = matchedData(req);
    const data = await upstream(
      "series lookup",
      "That series couldn't be loaded. Try again in a moment.",
      () => getSeries(name, countryOf(req.query.country)),
    );
    if (!data) throw new NotFoundError("We couldn't find that series.");
    if (strict && data.info && !fitsAddress(name, data.info))
      throw new NotFoundError("We couldn't find that series.");
    res.json(data);
    // for the page's "Watched the anime?" bar next time (afterAnime.ts)
    if (data.info && !isCrawler(req.get("user-agent")))
      learnAnimeAnswer(data.info.name);
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
      // a crawler reads what's saved; only a visitor's page looks one up
      !isCrawler(req.get("user-agent")),
    );
    // in the country they shop in, like every other price
    const known = await priceQueries
      .getKnownPrices(
        lines.flatMap((l) => l.books.flatMap((b) => b.isbn13 ?? [])),
        countryOf(req.query.country),
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

// GET /series-sets?name=&human=  looks for the series' box sets at the free
// sources (eBay, Books-A-Million) when the saved answer is old, and hands
// back the series' sets as its page shows them. Only for a page that passed
// the person check: a crawler never sets a search off. Never a paid search
const seriesSets = [
  ...seriesName,
  async (req: Request, res: Response) => {
    const name: string = matchedData(req).name;
    // Canada's sets are eBay.ca's, in Canadian dollars
    const country = countryOf(req.query.country);
    const allowed =
      !isCrawler(req.get("user-agent")) &&
      (await isHuman(req.query.human, clientIp(req)));
    const data = allowed
      ? await getSeries(name, country).catch(() => null)
      : null;
    const scanned = data
      ? await scanBoxSets(data.name, data.volumes, country).catch(() => false)
      : false;
    // unchanged: the page keeps what it has
    if (!scanned) return void res.json({ boxSets: null });
    const fresh = await getSeries(name, country).catch(() => null);
    res.json({ boxSets: fresh?.boxSets ?? null });
  },
];

// GET /stats  the About page's count: volumes priced in the last 30 days
const stats = async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ pricedVolumes: await getPricedCount() });
};

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

// GET /editions-index  the /editions page: every series with an omnibus or
// deluxe line, and what each line holds
const editionsIndex = async (_req: Request, res: Response) => {
  res.set("Cache-Control", CACHE_10_MIN).json(await getEditionsIndex());
};

// GET /cover/:isbn?w=330  the edition's cover image. With a width (one of
// sources/coverResizer.ts COVER_WIDTHS, or the next one up): resized to it
// and sent as WebP, from the largest picture the source has. With none: the
// source's own medium picture as it came, as before widths (link previews
// and old pages still ask that way).
// The page offers the browser several widths and it picks by the slot and
// the screen (client lib/coverSizes.ts)
const cover = [
  ...isbnParam,
  async (req: Request, res: Response) => {
    const { isbn } = matchedData(req);
    const width = allowedWidth(req.query.w);
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
      const sent = await sendImage(
        res,
        coverSource(id, fallback, width),
        width,
        { mustNotBeBlank: true },
      );
      // a blank page for a cover: none, as far as the page is concerned (its
      // stand-in shows). Kept a day, as any "no cover" is
      if (!sent) {
        res.set("Cache-Control", "public, max-age=86400");
        sendError(res, 404, "This edition has no cover.");
      }
    } catch (e) {
      if (!(e instanceof CoverLookupPaused)) {
        console.error("cover lookup failed:", (e as Error).message);
      }
      // Open Library's API is out of reach, but its image host usually
      // isn't: send the browser to the by-ISBN image. That one is limited
      // per visitor rather than per server, so it's fine as a stopgap.
      // Never cached, so the next visit gets the by-ID image again
      res.set("Cache-Control", "no-store");
      res.redirect(302, isbnCoverImageUrl(isbn, width ? "L" : "M"));
    }
  },
];

// Where an edition's cover is fetched from. To be resized: the largest the
// source has (Open Library's large; Google's at the widest we make). With
// no width asked: what it always was, Open Library's medium or the Google
// cover as saved
const WIDEST = COVER_WIDTHS.at(-1)!;
function coverSource(
  id: number | null,
  google: string | null | undefined,
  width: CoverWidth | null,
) {
  if (google) return width ? googleCoverAt(google, WIDEST) : google;
  return coverImageUrl(id!, width ? "L" : "M");
}

// GET /cover/series?name=<the series>&u=<its AniList cover>&w=170  a series'
// cover, resized. In this order, the first one that can be had:
//
//   1. the English one: its first US volume's cover, where the series'
//      volumes are saved (sources/englishCover.ts)
//   2. the Japanese one: AniList's cover, `u`. Only AniList's own cover
//      addresses are fetched (covers.ts anilistSources)
//
// `first=japan` swaps the two (New's In Japan side is about the Japanese
// edition). Either `name` or `u` may be left out; with neither, a 400.
// Nothing to show at all is a 404, and the page draws its own cover
const SERIES_NAME_MAX = 200;
// a Japanese cover sent because the English one isn't known yet is kept a
// day, not 30: the English one takes its place once the volumes are saved
const KEPT_A_DAY = "public, max-age=86400";
const seriesCover = async (req: Request, res: Response) => {
  const width = allowedWidth(req.query.w);
  const { u, name, first } = req.query;
  const japanese =
    width && typeof u === "string" ? anilistSources(u, width) : [];
  const named = typeof name === "string" && name.length <= SERIES_NAME_MAX;
  if (!width || (!japanese.length && !named)) {
    sendError(res, 400, "That isn't a cover we can resize.");
    return;
  }
  const english = named
    ? await englishCoverSource(name, width).catch((e: Error) => {
        console.error("english cover lookup failed:", e.message);
        return null;
      })
    : null;
  // the Japanese cover is only a stand-in when the English one was wanted
  // first and isn't there
  const standsIn = named && first !== "japan" && !english;
  const englishTry: CoverTry[] = english
    ? [{ url: english, mustBeCoverShaped: true }]
    : [];
  const japaneseTries: CoverTry[] = japanese.map((url) => ({
    url,
    kept: standsIn ? KEPT_A_DAY : undefined,
  }));
  const tries =
    first === "japan"
      ? [...japaneseTries, ...englishTry]
      : [...englishTry, ...japaneseTries];

  for (const { url, kept, mustBeCoverShaped } of tries) {
    try {
      const sent = await sendImage(res, url, width, {
        kept,
        mustBeCoverShaped,
      });
      if (sent) return;
    } catch (e) {
      // a picture its host no longer has is expected, and the next one is
      // tried: only other failures are worth a line
      if (!/answered 404/.test((e as Error).message))
        console.error(
          `series cover failed for ${named ? name : "a series"}:`,
          (e as Error).message,
        );
    }
  }
  // none could be fetched from here: the saved picture itself, as the page
  // would have asked AniList for it before
  if (japanese.length) {
    res.set("Cache-Control", "no-store");
    res.redirect(302, japanese.at(-1)!);
    return;
  }
  // no cover known for it: said again for an hour, then looked at afresh
  res.set("Cache-Control", "public, max-age=3600");
  sendError(res, 404, "No cover for this series.");
};
// one picture to try: where it is, how long it may be kept (30 days unless
// said), and whether to pass over a store's "no image" picture
type CoverTry = { url: string; kept?: string; mustBeCoverShaped?: boolean };

// Where the series' English cover is, or null when we don't have one.
// Only what's already found: Google Books is never asked from here
async function englishCoverSource(name: string, width: CoverWidth) {
  const isbn = await englishCoverIsbn(name);
  if (!isbn) return null;
  const id = await editionCoverId(isbn);
  const google = id ? null : await fallbackCover(isbn, { ask: false });
  return id || google ? coverSource(id, google, width) : null;
}

// GET /cover/shelf/:code  the picture a shared shelf's link shows when it's
// pasted somewhere (util/shelf/shelfCard.ts): its favourites, or what its
// owner has most of, fanned out. Kept a day: the shelf changes. 404 when
// the shelf isn't shared, or has no cover to show
const SHELF_CARD_KEPT = "public, max-age=86400";
const shelfCardImage = [
  param("code").matches(/^[\w-]{4,16}$/),
  rejectInvalid,
  async (req: Request, res: Response) => {
    const shelf = await userQueries.getSharedShelf(matchedData(req).code);
    const manga = shelf?.manga ?? [];
    // the ones they put at the top, in their order; then five stars (only
    // if they share their ratings: the picture mustn't give them away);
    // then the most volumes owned
    const top = topOf(
      shelf?.prefs,
      manga.map((m) => m.name),
    );
    const showsRatings = shelf?.shareRatings !== false;
    const placeIn = (name: string) =>
      top.includes(name) ? top.indexOf(name) : top.length;
    const picked = [...manga]
      .sort(
        (a, b) =>
          placeIn(a.name) - placeIn(b.name) ||
          (showsRatings
            ? Number(b.rating === 5) - Number(a.rating === 5)
            : 0) ||
          (b.volumesOwned ?? 0) - (a.volumesOwned ?? 0),
      )
      // AniList's own covers only, at their medium size (covers.ts)
      .flatMap((m) => anilistSources(m.image ?? "", 220).slice(-1))
      .slice(0, MOST_COVERS);
    const covers = (
      await Promise.all(picked.map((url) => coverBytes(url).catch(() => null)))
    ).filter((cover) => cover !== null);
    const card = await shelfCard(covers).catch(() => null);
    if (!card) {
      sendError(res, 404, "No picture for this shelf.");
      return;
    }
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": SHELF_CARD_KEPT });
    res.end(card);
  },
];

// A cover image passed on, kept 30 days by browsers and Cloudflare: as it
// came, or (with a width) resized to it as WebP. Anything that isn't an
// image (a host's error page) throws, and the route falls back to sending
// the browser there itself
const COVER_FETCH_MS = 10_000;
const COVER_TYPES = /^image\/(jpeg|png|webp|gif|avif)\b/i;
const COVER_MAX_BYTES = 8 * 1024 * 1024;
// a picture fetched from its host: its bytes and what kind it is
async function fetchImage(url: string) {
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
  return { image, type };
}
const coverBytes = async (url: string) => (await fetchImage(url)).image;

// False (and nothing sent) when the picture was passed over for not being
// cover shaped
async function sendImage(
  res: Response,
  url: string,
  width: CoverWidth | null = null,
  {
    kept = "public, max-age=2592000",
    mustBeCoverShaped = false,
    mustNotBeBlank = false,
  }: {
    kept?: string;
    mustBeCoverShaped?: boolean;
    mustNotBeBlank?: boolean;
  } = {},
) {
  const { image, type } = await fetchImage(url);
  if (mustBeCoverShaped && !(await isCoverShaped(image))) return false;
  // a blank page isn't a cover (a picture sharp can't read is let through)
  if (mustNotBeBlank && (await isBlankPage(image).catch(() => false)))
    return false;
  // a picture that can't be resized still goes out, as it came
  const resized = width
    ? await resizeCover(image, width).catch((e: Error) => {
        console.error("cover resize failed:", e.message);
        return null;
      })
    : null;
  res.set({
    "Content-Type": resized ? "image/webp" : type,
    "Cache-Control": kept,
  });
  res.end(resized ?? image);
  return true;
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
  query("strict").optional().isBoolean().toBoolean(),
  ...seriesName,
  async (req: Request, res: Response) => {
    const { name, strict } = matchedData(req);
    const data = await getSeriesSummary(name);
    // a made-up address isn't described as the real series AniList guessed
    const fits = !strict || !data || fitsAddress(name, data);
    if (data && fits) return res.set("Cache-Control", CACHE_10_MIN).json(data);
    // nothing stored to describe it: not "missing" either. Finding out would
    // take the series page's whole catalog lookup, which crawlers sending
    // made-up names would turn into a flood of Open Library searches
    return res.sendStatus(204);
  },
];

export default {
  seriesNear,
  stats,
  scan,
  editions,
  seriesSets,
  canadaVolume,
  search,
  seriesSearch,
  volume,
  series,
  highlights,
  deals,
  seriesIndex,
  editionsIndex,
  cover,
  seriesCover,
  shelfCardImage,
  volumeSummary,
  seriesSummary,
};
