import queries from "../models/queries.js";
const updateData = (req, res) => {
  const { id } = req.params;
  const { name, bookmark, status, description } = req.body;
  try {
    queries.updateMangaPost(id, name, bookmark, status, description);
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(500);
    throw new Error(e.message);
  }
};

export default { updateData };
