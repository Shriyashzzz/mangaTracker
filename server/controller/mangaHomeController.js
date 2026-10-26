import { pool } from "../models/pool.js";
import queries from "../models/queries.js";
import { getShelfPrices } from "../prices/service.js";

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

export default { getAllManga, getShelfPriceTags };
