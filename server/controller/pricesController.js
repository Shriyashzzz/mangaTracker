import { query, param, validationResult, matchedData } from "express-validator";
import { searchVolumes, toIsbn13 } from "../prices/catalog.js";
import {
  CoverLookupPaused,
  coverImageUrl,
  editionCoverId,
  isbnCoverImageUrl,
} from "../prices/covers.js";
import {
  getHighlights,
  getSeries,
  getSeriesSummary,
  getVolumePrices,
  getVolumeSummary,
  searchSeries,
} from "../prices/service.js";
import { isCrawler } from "../prices/crawlers.js";

const rejectInvalid = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array() });
    return;
  }
  next();
};

const search = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search for at least 2 characters"),
  rejectInvalid,
  async (req, res) => {
    try {
      res.json({ results: await searchVolumes(matchedData(req).q) });
    } catch (e) {
      console.error("volume search failed:", e);
      res.status(502).json({
        error: [
          { msg: "The book catalog didn't answer. Try again in a moment." },
        ],
      });
    }
  },
];

const volume = [
  param("isbn")
    .customSanitizer(toIsbn13)
    .custom((v) => v !== null)
    .withMessage("That isn't a valid ISBN"),
  rejectInvalid,
  async (req, res) => {
    try {
      const data = await getVolumePrices(matchedData(req).isbn, {
        refresh: !isCrawler(req.get("user-agent")),
      });
      if (!data) {
        res
          .status(404)
          .json({ error: [{ msg: "We couldn't find that volume." }] });
        return;
      }
      res.json(data);
    } catch (e) {
      console.error("price lookup failed:", e);
      res.status(502).json({
        error: [{ msg: "Prices couldn't be loaded. Try again in a moment." }],
      });
    }
  },
];

const series = [
  query("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Which series?"),
  rejectInvalid,
  async (req, res) => {
    try {
      const data = await getSeries(matchedData(req).name);
      if (!data) {
        res
          .status(404)
          .json({ error: [{ msg: "We couldn't find that series." }] });
        return;
      }
      res.json(data);
    } catch (e) {
      console.error("series lookup failed:", e);
      res.status(502).json({
        error: [
          { msg: "That series couldn't be loaded. Try again in a moment." },
        ],
      });
    }
  },
];

const highlights = async (req, res) => {
  try {
    res.json(await getHighlights());
  } catch (e) {
    console.error("highlights failed:", e);
    res.status(502).json({ error: [{ msg: "Couldn't load highlights." }] });
  }
};

const seriesSearch = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search for at least 2 characters"),
  rejectInvalid,
  async (req, res) => {
    try {
      res.json({ results: await searchSeries(matchedData(req).q) });
    } catch (e) {
      console.error("series search failed:", e);
      res.status(502).json({
        error: [{ msg: "Series search didn't answer. Try again in a moment." }],
      });
    }
  },
];

const cover = [
  param("isbn")
    .customSanitizer(toIsbn13)
    .custom((v) => v !== null)
    .withMessage("That isn't a valid ISBN"),
  rejectInvalid,
  async (req, res) => {
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
        console.error("cover lookup failed:", e.message);
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

// for the site's link-preview server; database only, so they're quick
const volumeSummary = [
  param("isbn")
    .customSanitizer(toIsbn13)
    .custom((v) => v !== null)
    .withMessage("That isn't a valid ISBN"),
  rejectInvalid,
  async (req, res) => {
    const data = await getVolumeSummary(matchedData(req).isbn);
    if (!data) {
      res.sendStatus(404);
      return;
    }
    res.set("Cache-Control", "public, max-age=600").json(data);
  },
];

const seriesSummary = [
  query("name").trim().isLength({ min: 2, max: 120 }),
  rejectInvalid,
  async (req, res) => {
    const data = await getSeriesSummary(matchedData(req).name);
    if (!data) {
      res.sendStatus(404);
      return;
    }
    res.set("Cache-Control", "public, max-age=600").json(data);
  },
];

export default {
  search,
  volume,
  series,
  seriesSearch,
  highlights,
  cover,
  volumeSummary,
  seriesSummary,
};
