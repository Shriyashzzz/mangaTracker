// the browser and the server say the same when two titles are one series
import * as browser from "../../../../client/src/lib/titleKey.js";
import { shelfKey, titleKey } from "../../util/shelf/titleKey.js";

test("the browser's title key is the server's", () => {
  for (const name of [
    "One Piece",
    "one-piece",
    "Café Au Lait",
    "Pokémon Adventures",
    "[Oshi no Ko]",
    "葬送のフリーレン",
    "86—EIGHTY-SIX",
    "Spy x Family",
  ]) {
    expect(browser.titleKey(name)).toBe(titleKey(name));
    expect(browser.shelfKey(name, true)).toBe(shelfKey(titleKey(name), true));
  }
});
