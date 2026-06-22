import { validationResult, matchedData, body } from "express-validator";

const emptyMessage = `cannot be empty luv <3`;
const lengthError = `Ttile should be between 3 to 150 charachters long! <3`;

//valdiate all the params
const validationChain = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage(`Manga Title ${emptyMessage}`)
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
    .notEmpty()
    .withMessage(`Description cannot be ${emptyMessage}`)
    .isLength({ min: 10, max: 450 })
    .withMessage(
      `Description of the manga should be between 10 to 450 charachters long! <3`,
    ),
  body["image"]
    .optional({ values: "falsy" })
    .trim()
    .isURL()
    .withMessage("Please provide a valid URL"),
];
const addMangaController = [validationChain, async (req, res) => {}];

export default { addMangaController };
