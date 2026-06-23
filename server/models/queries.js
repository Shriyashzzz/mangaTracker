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

const changeMangaStatus = async (id, newStatus) => {
  await pool.query(
    `
    UPDATE manga
    SET status = ($1)
    WHERE id = ($2)
    `,
    [newStatus, id],
  );
};

const deleteMangaFromDb = async (id) => {
  await pool.query(
    `DELETE FROM manga
    WHERE id = ($1)
    `,
    [id],
  );
};

const updateMangaPost = async (id, name, bookmark, status, description) => {
  if (bookmark) {
    await pool.query(
      `
        UPDATE manga
        SET name = ($1), status = ($2), description = ($3), bookmark = ($4) 
        WHERE id = ($5);
        `,
      [name, status, description, bookmark, id],
    );
  } else {
    await pool.query(
      `
        UPDATE manga
        SET name = ($1), status = ($2), description = ($3)
        WHERE id = ($4);
        `,
      [name, status, description, id],
    );
  }
};

const addManagToDb = async (
  name,
  genre,
  description,
  image,
  status,
  bookmark,
) => {
  const result = await pool.query(
    `
    INSERT INTO manga ( name, genre, description, image, status, bookmark)
    VALUES (($1),($2),($3),($4),($5),($6))
    RETURNING id;
    `,
    [name, genre, description, image, status, bookmark],
  );
  return result.rows[0].id;
};
export default {
  getMangaData,
  getThatManga,
  changeMangaStatus,
  deleteMangaFromDb,
  updateMangaPost,
  addManagToDb,
};
