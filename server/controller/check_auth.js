import queries from "../models/queries.js";

// only lets signed in users through
export const requireSignIn = (req, res, next) => {
  if (!req.session.userId) {
    res.sendStatus(401);
    return;
  }
  next();
};

// authenticator middleware, makes sure the client is the owner of the manga before giving details
export const requireAuth = async (req, res, next) => {
  const mangaId = req.params.id;
  const userSessionId = req.session.userId;

  if (!userSessionId) {
    res.sendStatus(401);
    return;
  }

  const manga = await queries.getThatManga(mangaId);
  if (!manga) {
    res.sendStatus(404);
  } else if (manga.user_id == userSessionId) {
    next();
  } else {
    res.sendStatus(403);
  }
};
