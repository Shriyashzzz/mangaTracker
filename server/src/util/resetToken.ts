// The secret in a password reset link. The link carries the token itself;
// the database only keeps its hash, so a copy of the database can't be used
// to reset anyone's password.
import { createHash, randomBytes } from "node:crypto";

// how long a reset link works. The email says the same number
export const RESET_LINK_MINUTES = 15;

// what is saved, and what a link's token is looked up by
export const hashOfResetToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// a new token nobody could guess: 64 letters and numbers
export const newResetToken = () => randomBytes(32).toString("hex");
