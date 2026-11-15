// the name others see for a reader (util/shelf/readerNames.ts readerName)
import { defaultReaderName, readerName } from "../../util/shelf/readerNames.js";

test("a name can't be turned around by invisible direction characters", () => {
  // "‮olleh" shows as "hello" backwards without the fix
  expect(readerName({ id: 1, displayName: "‮olleh" })).toBe("olleh");
  expect(readerName({ id: 1, displayName: "Kenji⁦⁩" })).toBe("Kenji");
});

test("no name, or only direction characters: the one picked for them", () => {
  expect(readerName({ id: 7, displayName: null })).toBe(defaultReaderName(7));
  expect(readerName({ id: 7, displayName: "‮" })).toBe(defaultReaderName(7));
});
