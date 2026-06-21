import { pool } from "./pool.js";

const getMangaData = async () => {
  const data = await pool.query(`SELECT * FROM manga ORDER BY bookmark DESC`);
  return data.rows;
};

const getThatManga = async (givenId) => {
  const data = await pool.query(`SELECT * FROM manga WHERE id = ($1)`, [
    givenId,
  ]);
  return data.rows[0];
};

const changeMangaStatus = (id, newStatus) => {
  pool.query(
    `
    UPDATE manga
    SET status = ($1)
    WHERE id = ($2)
    `,
    [newStatus, id],
  );
};

const deleteMangaFromDb = (id) => {
  pool.query(
    `DELETE FROM manga
    WHERE id = ($1)
    `,
    [id],
  );
};

const updateMangaDetails = (id, name, status, description, bookmark) => {};
export default {
  getMangaData,
  getThatManga,
  changeMangaStatus,
  deleteMangaFromDb,
};
