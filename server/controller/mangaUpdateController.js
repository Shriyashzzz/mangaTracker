import queries from "../models/queries.js";
import { body, validationResult, matchedData } from "express-validator";

const emptyMessage = `cannot be empty luv <3`;
const lengthError = `Ttile should be between 3 to 150 charachters long! <3`;

//valdiate all the params
const validationData = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage(`Manga Ttile ${emptyMessage}`)
    .isLength({ min: 3, max: 150 })
    .withMessage(lengthError),
  body("bookmark")
    .optional({ values: "falsy" })
    .trim()
    .isNumeric()
    .withMessage(`Bookmark has to be Numeric luv!`),
  body("status").notEmpty(),
  body("description")
    .trim()
    .optional({ values: "falsy" })
    .isLength({ min: 10, max: 450 })
    .withMessage(
      `Description of the manga should be atleast between 10 to 450 charachters long! <3`,
    ),
];

const updateData = [
  validationData,
  async (req, res) => {
    const { id } = req.params;
    try {
      const error = validationResult(req);
      if (error.isEmpty()) {
        console.log("no errors on client side");
        const { name, bookmark, status, description } = matchedData(req);
        await queries.updateMangaPost(id, name, bookmark, status, description);
        res.sendStatus(200);
      } else {
        res.status(400).json({
          error: error.array(),
        });
      }
    } catch (e) {
      res.sendStatus(500);
      throw new Error(e.message);
    }
  },
];

export default { updateData };
