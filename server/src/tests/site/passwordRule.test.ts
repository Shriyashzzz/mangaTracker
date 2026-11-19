// The sign-up and reset forms check a new password's length before sending
// it (so a slip doesn't use up one of the hour's sign-ups), with the
// client's own copy of the server's rule. The two must say the same
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NEW_PASSWORD_MIN } from "../../controllers/authController.js";

const signUpFile = fileURLToPath(
  new URL("../../../../client/src/lib/passwordRule.ts", import.meta.url),
);

test("the forms ask for the same password length as the server", () => {
  const found = readFileSync(signUpFile, "utf8").match(
    /const NEW_PASSWORD_MIN = (\d+);/,
  );
  expect(Number(found?.[1])).toBe(NEW_PASSWORD_MIN);
});
