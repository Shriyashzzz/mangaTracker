// An edition's name cut short (client/src/lib/editionShort.ts)
import { shortBookName } from "../../../../client/src/lib/editionShort.js";
import { EDITION_NAMES } from "../../util/shelf/editionNames.js";

test("the long names are cut to fit a row", () => {
  expect(shortBookName("Definitive", 3)).toBe("Def. 3");
  expect(shortBookName("Omnibus", 12)).toBe("Omni 12");
  expect(shortBookName("Perfect Edition", 5)).toBe("Perf. 5");
  expect(shortBookName("3-in-1", 4)).toBe("3-in-1 #4");
  expect(shortBookName("VIZBIG", 13)).toBe("VIZBIG 13");
  // one the table doesn't know: "Edition" off, a long word cut
  expect(shortBookName("Treasury Edition", 2)).toBe("Trea. 2");
  expect(shortBookName("Gold Edition", 2)).toBe("Gold 2");
});

test("every edition the app names has a short form of 6 letters or fewer", () => {
  for (const { label } of EDITION_NAMES) {
    const short = shortBookName(label, 1).replace(/ #?1$/, "");
    expect([label, short.length <= 6]).toEqual([label, true]);
  }
});
