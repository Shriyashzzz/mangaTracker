import { body, validationResult, matchedData } from "express-validator";
import queries from "../models/queries.js";
import bcrypt from "bcryptjs";
const validateData = [
  body("username")
    .trim()
    .notEmpty()
    .isLength({ min: 4, max: 40 })
    .isAlphanumeric()
    .withMessage("Username has to be between 4 to 40 charachters long <3"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password cannot be empty luv")
    .isLength({ min: 5 })
    .withMessage("Password has to be atleast 5 charachters long! "),
];

export const signUpController = [
  validateData,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (errors.isEmpty()) {
        const { username, password } = matchedData(req);
        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = await queries.addNewUser(username, hashedPassword);
        if (userId) {
          req.session.userId = userId;
        }
        res.sendStatus(201);
        return;
      } else {
        res.status(401).json({
          errors: errors.array(),
        });
      }
    } catch (e) {
      next(e);
    }
  },
];
