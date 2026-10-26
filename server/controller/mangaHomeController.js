import { pool } from "../models/pool.js";
import queries from "../models/queries.js";
import { findOnShelf, getShelfPrices } from "../prices/service.js";
import { body, query, validationResult, matchedData } from "express-validator";

const getAllManga = async (req, res) => {
  res.json({
    mangaData: await queries.getMangaData(req.session.userId),
  });
};

// the cheapest known price for each manga on the shelf, for the cards
const getShelfPriceTags = async (req, res) => {
  const manga = await queries.getMangaData(req.session.userId);
  res.json(
    await getShelfPrices(manga.map((m) => ({ id: m.id, name: m.name }))),
  );
};

// is this series on the shelf? For the volume page's shelf button
const matchSeries = [
  query("series").trim().isLength({ min: 2, max: 150 }),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      res.sendStatus(400);
      return;
    }
    const manga = await queries.getMangaData(req.session.userId);
    const found = await findOnShelf(manga, matchedData(req).series);
    res.json(
      found && {
        id: found.id,
        name: found.name,
        bookmark: found.bookmark,
        status: found.status,
        volumesOwned: found.volumes_owned,
      },
    );
  },
];

// "I own Vol. 15", and its undo. Sets the number as given; null clears it
const setOwned = [
  body("volumesOwned")
    .optional({ values: "null" })
    .isInt({ min: 1, max: 999 })
    .toInt(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      res.status(400).json({ error: [{ msg: "That isn't a volume number." }] });
      return;
    }
    const value = matchedData(req).volumesOwned ?? null;
    res.json({
      volumesOwned: await queries.setVolumesOwned(req.params.id, value),
    });
  },
];

export default { getAllManga, getShelfPriceTags, matchSeries, setOwned };
