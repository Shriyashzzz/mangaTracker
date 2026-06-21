import { pool } from "../models/pool.js";
import queries from "../models/queries.js";

const getAllManga = async (req, res) => {
  res.json({
    mangaData: await queries.getMangaData(),
  });
};

export default { getAllManga };
