// The site opened inside its Google Play app (client/src/lib/playApp.ts)
import {
  openedFromPlayApp,
  PLAY_PACKAGE,
} from "../../../../client/src/lib/playApp.js";

test("only the Play app's own address counts", () => {
  expect(openedFromPlayApp(`android-app://${PLAY_PACKAGE}/`)).toBe(true);
  expect(openedFromPlayApp(`android-app://${PLAY_PACKAGE}`)).toBe(true);
  // another app, a website, or none
  expect(openedFromPlayApp("android-app://com.google.android.gm/")).toBe(false);
  expect(openedFromPlayApp("https://www.google.com/")).toBe(false);
  expect(openedFromPlayApp("")).toBe(false);
});
