// What an owned book is checked against, wherever one comes in (a scan's
// POST, an import's entries).
import { body } from "express-validator";

const EDITION_KINDS = ["single", "omnibus", "deluxe", "boxset"] as const;

// what they paid (cents, up to $100,000) and the day they bought it
// ("2026-01-05"); null clears either
export const purchaseFields = (prefix = "") => [
  body(`${prefix}paidCents`)
    .optional({ values: "null" })
    .isInt({ min: 0, max: 10_000_000 })
    .toInt(),
  body(`${prefix}boughtOn`)
    .optional({ values: "null" })
    .isISO8601({ strict: true })
    .isLength({ min: 10, max: 10 }),
];

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
  ...purchaseFields(`${list}.*.`),
  body(`${list}.*.volumes`).isArray({ min: 1, max: 200 }),
  body(`${list}.*.volumes.*`).isFloat({ min: 0, max: 999 }).toFloat(),
];
