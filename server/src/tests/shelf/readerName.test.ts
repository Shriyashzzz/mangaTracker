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

test("a stand-in name is a listed name and a four-digit number, the same each time", () => {
  const name = defaultReaderName(360);
  expect(name).toMatch(/^.+ #\d{4}$/);
  expect(defaultReaderName(360)).toBe(name);
});

test("no two of the first 30,000 accounts get the same stand-in name", () => {
  const seen = new Set<string>();
  for (let id = 1; id <= 30_000; id++) seen.add(defaultReaderName(id));
  expect(seen.size).toBe(30_000);
});

test("accounts made one after another don't get neighbouring names", () => {
  const names = [1, 2, 3, 4].map(defaultReaderName);
  expect(new Set(names.map((n) => n.replace(/ #\d+$/, ""))).size).toBe(4);
  // a name that carries a number takes the account's: never "#7 #4821"
  for (let id = 1; id <= 60; id++)
    expect(defaultReaderName(id)).not.toMatch(/#\d+ #/);
});
