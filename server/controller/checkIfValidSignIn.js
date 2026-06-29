import queries from "../models/queries.js";
import { validationResult, matchedData, body } from "express-validator";
const validateData = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("I need your name to let you in, come on you know that!")
    .isAlphanumeric()
    .isLength({ min: 4, max: 40 }),
  body("password")
    .notEmpty()
    .withMessage("Alright, don't forget your secret code. spill the beans now!")
    .isLength({ min: 5 }),
];

export const checkIfValidSignIn = [
  validateData,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (errors.isEmpty()) {
        const { username, password } = matchedData(req);
        console.log(username);
        const getUser = await queries.checkIfUserExists(username, password);
        if (getUser.userId) {
          req.session.userId = getUser.userId;
          res.sendStatus(200);
          return;
        }
        res.sendStatus(getUser.status);
        return;
      } else {
        res.status(400).json({
          error: errors.array(),
        });
      }
    } catch (err) {
      next(err);
    }
  },
];
