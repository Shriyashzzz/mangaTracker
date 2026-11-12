import { editionVolumes, withoutEdition } from "../../util/shelf/editions.js";

test("a scanned deluxe or two-in-one book is its series' volumes", () => {
  expect(withoutEdition("Berserk Deluxe Edition")).toBe("Berserk");
  expect(withoutEdition("Monster: The Perfect Edition")).toBe("Monster");
  expect(withoutEdition("Rave Master")).toBe("Rave Master");
  expect(
    editionVolumes(
      "Berserk Deluxe Edition",
      "Berserk Deluxe Edition Volume 2",
      2,
    ),
  ).toEqual([4, 5, 6]);
  expect(
    editionVolumes(
      "Fruits Basket Collector's Edition",
      "Fruits Basket Collector's Edition, Vol. 12",
      12,
    ),
  ).toEqual([23]);
  // a plain single volume, or past the edition's books: nothing to map
  expect(editionVolumes("Berserk", "Berserk, Vol. 2", 2)).toBeNull();
  expect(
    editionVolumes("Berserk Deluxe Edition", "Berserk Deluxe 15", 15),
  ).toBeNull();
});
