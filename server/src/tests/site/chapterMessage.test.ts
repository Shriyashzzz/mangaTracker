// what a chapter the server won't take is told: the reason, not "a number"
import { chapterMessage } from "../../controllers/manga/fields.js";

test("an out-of-range chapter says why", () => {
  expect(chapterMessage("12.5")).toBe("Chapters are whole numbers. Try 12.");
  expect(chapterMessage("-5")).toBe("Chapters start at 0.");
  expect(chapterMessage("999999")).toBe("Chapters go up to 100,000.");
  expect(chapterMessage("abc")).toBe("Chapter has to be a number.");
});
