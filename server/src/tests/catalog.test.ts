import { isIsbn13, toIsbn13 } from "../prices/catalog.js";

describe("toIsbn13", () => {
  test("keeps an ISBN-13, ignoring dashes and spaces", () => {
    expect(toIsbn13("978-1-9747-2576-2")).toBe("9781974725762");
  });
  test("converts an ISBN-10 with the right check digit", () => {
    expect(toIsbn13("1974725766")).toBe("9781974725762");
  });
  test("rejects anything else", () => {
    expect(toIsbn13("12345")).toBeNull();
    expect(toIsbn13("not an isbn")).toBeNull();
  });
});

test("isIsbn13", () => {
  expect(isIsbn13("9781974725762")).toBe(true);
  expect(isIsbn13("1974725766")).toBe(false);
});
