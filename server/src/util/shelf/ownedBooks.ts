// What an owned book is checked against, wherever one comes in (a scan's
// POST, an import's entries).
import { body } from "express-validator";

export const EDITION_KINDS = ["single", "omnibus", "deluxe", "boxset"] as const;

export const bookFields = (list: string, most: number) => [
  body(list).optional().isArray({ max: most }),
  body(`${list}.*.isbn13`)
    .optional({ values: "null" })
    .matches(/^97[89]\d{10}$/),
  body(`${list}.*.edition`).isIn(EDITION_KINDS),
  body(`${list}.*.number`)
    .optional({ values: "null" })
    .isFloat({ min: 0, max: 999 })
    .toFloat(),
  body(`${list}.*.title`)
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: 200 }),
  body(`${list}.*.volumes`).isArray({ min: 1, max: 200 }),
  body(`${list}.*.volumes.*`).isFloat({ min: 0, max: 999 }).toFloat(),
];
