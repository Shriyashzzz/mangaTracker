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
  console.log(id, status);
  if (!id && !status) return res.status(404).json({ error: "Not Found" });
  try {
    await queries.changeMangaStatus(id, status);
    res.sendStatus(204);
  } catch (e) {
    res.sendStatus(404);
    throw new Error(e.message);
  }
};

export default { getMangaDetailController, changeMangaStatus };
