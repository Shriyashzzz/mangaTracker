import queries from "../models/queries.js";

// authenticator middleware, makes sure the client is the owner of the manga before giving details
export const requireAuth = async (req, res, next) => {
  const mangaId = req.params.id;
  const userSessionId = req.session.userId;

  const manga = await queries.getThatManga(mangaId);
  if (manga.user_id == userSessionId) {
    next();
  } else {
    res.sendStatus(403);
  }
};
