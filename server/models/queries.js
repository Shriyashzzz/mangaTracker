import { pool } from "./pool.js";
import bcrypt from "bcryptjs";

const getMangaData = async (userId) => {
  const data = await pool.query(
    `SELECT * FROM manga WHERE user_id = $1 ORDER BY bookmark DESC`,
    [userId],
  );
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

const updateMangaPost = async (
  id,
  name,
  bookmark,
  status,
  description,
  image,
  volumesOwned,
) => {
  if (bookmark) {
    await pool.query(
      `
        UPDATE manga
        SET name = ($1), status = ($2), description = ($3), bookmark = ($4), image = ($5),
            volumes_owned = ($7)
        WHERE id = ($6);
        `,
      [name, status, description, bookmark, image, id, volumesOwned],
    );
  } else {
    await pool.query(
      `
        UPDATE manga
        SET name = ($1), status = ($2), description = ($3), image = ($4),
            volumes_owned = ($6)
        WHERE id = ($5);
        `,
      [name, status, description, image, id, volumesOwned],
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
  userId,
  volumesOwned,
) => {
  const result = await pool.query(
    `
    INSERT INTO manga ( name, genre, description, image, status, bookmark, user_id, volumes_owned)
    VALUES (($1),($2),($3),($4),($5),($6),($7),($8))
    RETURNING id;
    `,
    [name, genre, description, image, status, bookmark, userId, volumesOwned],
  );
  return result.rows[0].id;
};

const chnageMangaRating = async (id, newRating) => {
  await pool.query(
    `
    UPDATE manga 
    SET rating = ($2)
    WHERE id = ($1)
    `,
    [id, newRating],
  );
};

const checkIfUserExists = async (username, password) => {
  const user = await pool.query(
    `
      SELECT id, password FROM users
      WHERE username = ($1);
    `,
    [username],
  );
  if (user.rows.length !== 0) {
    if (await bcrypt.compare(password, user.rows[0].password)) {
      return { status: 200, message: "Success", userId: user.rows[0].id };
    } else {
      return { status: 401, message: "Incorrect password" };
    }
  } else {
    return { status: 404, message: "Incorrect Information" };
  }
};

const addNewUser = async (username, hashedPassword) => {
  const result = await pool.query(
    `
        INSERT INTO users (username, password)
        VALUES ($1,$2)
        RETURNING id;
        `,
    [username, hashedPassword],
  );

  return result.rows[0].id;
};

// display preferences (background, theme), kept as one small JSON object
const getPrefs = async (userId) => {
  const result = await pool.query(`SELECT prefs FROM users WHERE id = $1`, [
    userId,
  ]);
  return result.rows[0]?.prefs ?? {};
};

// merges the given keys into what's stored, leaving the rest alone
const updatePrefs = async (userId, patch) => {
  const result = await pool.query(
    `
      UPDATE users
      SET prefs = prefs || $2::jsonb
      WHERE id = $1
      RETURNING prefs;
    `,
    [userId, JSON.stringify(patch)],
  );
  return result.rows[0]?.prefs ?? {};
};

// how many volumes someone owns; null clears it. Returns the new value
const setVolumesOwned = async (id, volumesOwned) => {
  const result = await pool.query(
    `UPDATE manga SET volumes_owned = $2 WHERE id = $1 RETURNING volumes_owned`,
    [id, volumesOwned],
  );
  return result.rows[0]?.volumes_owned ?? null;
};

export default {
  getMangaData,
  getThatManga,
  changeMangaStatus,
  deleteMangaFromDb,
  updateMangaPost,
  addManagToDb,
  chnageMangaRating,
  checkIfUserExists,
  addNewUser,
  getPrefs,
  updatePrefs,
  setVolumesOwned,
};
