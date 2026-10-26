import { query, param, validationResult, matchedData } from "express-validator";
import { searchVolumes, toIsbn13 } from "../prices/catalog.js";
import {
  getHighlights,
  getSeries,
  getVolumePrices,
  searchSeries,
} from "../prices/service.js";

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
      const data = await getVolumePrices(matchedData(req).isbn);
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

export default { search, volume, series, seriesSearch, highlights };
