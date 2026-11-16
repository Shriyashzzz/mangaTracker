// The sign-up form checks a new password's length before sending it (so a
// slip doesn't use up one of the hour's sign-ups), with its own copy of the
// server's rule. The two must say the same
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NEW_PASSWORD_MIN } from "../../controllers/authController.js";

const signUpFile = fileURLToPath(
  new URL("../../../../client/src/pages/SignUp/SignUp.tsx", import.meta.url),
);

test("the sign-up form asks for the same password length as the server", () => {
  const found = readFileSync(signUpFile, "utf8").match(
    /const NEW_PASSWORD_MIN = (\d+);/,
  );
  expect(Number(found?.[1])).toBe(NEW_PASSWORD_MIN);
});
