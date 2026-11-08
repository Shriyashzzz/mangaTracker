// Reading a book's ISBN from a scanned barcode or a typed number
// (client/src/lib/barcode.ts)
import {
  isbnFromBarcode,
  isbnFromTyped,
  volumesFrom,
} from "../../../../client/src/lib/barcode.js";

test("a book's barcode is its ISBN-13", () => {
  // One Piece, Vol. 1 and Chainsaw Man, Vol. 1
  expect(isbnFromBarcode("9781569319017")).toBe("9781569319017");
  expect(isbnFromBarcode("9781974709939")).toBe("9781974709939");
});

test("anything else the camera catches is ignored", () => {
  // a misread last digit
  expect(isbnFromBarcode("9781569319018")).toBeNull();
  // a UPC on a box set's wrap, a price add-on, a shop sticker
  expect(isbnFromBarcode("012345678905")).toBeNull();
  expect(isbnFromBarcode("51099")).toBeNull();
  // a 13-digit EAN that isn't a book (not 978 or 979)
  expect(isbnFromBarcode("4006381333931")).toBeNull();
});

test("a typed ISBN, with dashes or the older 10 characters", () => {
  expect(isbnFromTyped("978-1-56931-901-7")).toBe("9781569319017");
  expect(isbnFromTyped(" 9781569319017 ")).toBe("9781569319017");
  // the same volume's ISBN-10
  expect(isbnFromTyped("1569319014")).toBe("9781569319017");
  // an ISBN-10 ending in X
  expect(isbnFromTyped("080442957X")).toBe("9780804429573");
  expect(isbnFromTyped("1569319015")).toBeNull();
  expect(isbnFromTyped("one piece")).toBeNull();
});

test("the volumes a scan is corrected to", () => {
  expect(volumesFrom("3")).toEqual([3]);
  expect(volumesFrom("4, 3")).toEqual([3, 4]);
  expect(volumesFrom("17-18")).toEqual([17, 18]);
  expect(volumesFrom("1 & 2 and 3")).toEqual([1, 2, 3]);
  expect(volumesFrom("")).toBeNull();
  expect(volumesFrom("0")).toBeNull();
  expect(volumesFrom("three")).toBeNull();
  // a whole run is a different job than one scanned book
  expect(volumesFrom("1-40")).toBeNull();
});
