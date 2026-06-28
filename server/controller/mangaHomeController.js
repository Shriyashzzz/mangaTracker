import { pool } from "../models/pool.js";
import queries from "../models/queries.js";

const getAllManga = async (req, res) => {
  console.log(req.session.userId);
  res.json({
    mangaData: await queries.getMangaData(req.session.userId),
  });
};

export default { getAllManga };
