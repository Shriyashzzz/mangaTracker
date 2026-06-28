import queries from "../models/queries.js";
export async function checkIfValidSignIn(req, res, next) {
  const { username, password } = req.body;
  const checkUser = await queries.checkIfUserExists(username, password);
  if (checkUser.userId) {
    req.session.userId = checkUser.userId;
    res.sendStatus(200);
    return;
  }
  res.sendStatus(checkUser.status);
  return;
}
