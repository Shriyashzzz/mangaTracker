import { pool } from "../models/pool.js";
import queries from "../models/queries.js";
const getMangaDetailController = async (req, res) => {
  const { id } = req.params;
  res.json({
    detail: await queries.getThatManga(id),
  });
};

const changeMangaStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!id && !status) return res.status(404).json({ error: "Not Found" });
  try {
    await queries.changeMangaStatus(id, status);
    res.sendStatus(204);
  } catch (e) {
    res.sendStatus(404);
    throw new Error(e.message);
  }
};

const deleteManga = async (req, res) => {
  const { id } = req.params;
  try {
    await queries.deleteMangaFromDb(id);
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(500);
    throw new Error(e.message);
  }
};

const patchMangaRating = async (req, res) => {
  const { id } = req.params;
  const { newRating } = req.body;
  try {
    await queries.chnageMangaRating(id, newRating);
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(500);
    throw new Error(e.message);
  }
};

export default {
  getMangaDetailController,
  changeMangaStatus,
  deleteManga,
  patchMangaRating,
};
