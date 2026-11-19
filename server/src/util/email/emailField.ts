// The rule for an email typed into a form, in one place: sign-up, the
// recovery email in settings, and asking for a password reset all use it.
// Saved in lowercase, so "Me@x.com" and "me@x.com" are one address, and the
// database can keep each address to one account.
import { body } from "express-validator";

export const EMAIL_TAKEN = "That email is already on another account.";

export const emailField = (field: string) =>
  body(field)
    .isString()
    .trim()
    .isLength({ max: 254 })
    .isEmail()
    .withMessage("That doesn't look like an email address.")
    .toLowerCase();
