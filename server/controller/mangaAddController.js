import { validationResult, matchedData, body } from "express-validator";
import queries from "../models/queries.js";

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
    .withMessage(`Description should be between 10-450 characters long!`),
  body("image")
    .optional({ values: "falsy" })
    .trim()
    .isURL()
    .withMessage("Please provide a valid URL"),
];
const addMangaController = [
  validationChain,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: errors.array(),
      });
    } else {
      let { name, description, image, status, bookmark, genre } =
        matchedData(req);
      if (!bookmark) {
        bookmark = 0;
      }

      console.log(name, description, image, status, bookmark, genre);
      try {
        await queries.addManagToDb(
          name,
          genre,
          description,
          image,
          status,
          bookmark,
        );
        res.status(200).json({
          error: [],
        });
      } catch (e) {
        console.log(`DB ERROR: ${e.message}`);

        if (
          e.message.includes(
            'duplicate key value violates unique constraint "manga_name_key"',
          )
        ) {
          return res.status(409).json({
            error: [{ msg: "A manga with this title already exists luv <3" }],
          });
        }
        res.status(500).json({
          error: [{ msg: "Something went wrong, please try again!" }],
        });
      }
    }
  },
];

export default { addMangaController };
