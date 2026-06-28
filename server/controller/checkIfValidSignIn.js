import queries from "../models/queries.js";
import { validationResult, matchedData, body } from "express-validator";
const validateData = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("I need your name to let you in, come on you know that!")
    .isLength({ min: 4, max: 40 }),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Alright, don't forget your secret code. spill the beans now!")
    .isLength({ min: 5 }),
];

export async function checkIfValidSignIn(req, res, next) {
  try {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      const { username, password } = matchedData(req);
      const checkUser = await queries.checkIfUserExists(username, password);
      if (checkUser.userId) {
        req.session.userId = checkUser.userId;
        res.sendStatus(200);
        return;
      }
      res.sendStatus(checkUser.status);
      return;
    } else {
    }
  } catch (e) {}
}
