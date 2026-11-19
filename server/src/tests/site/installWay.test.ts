// Whether and how the site can be installed (client/src/lib/installWay.ts)
import {
  installWayOf,
  isAppleMobile,
} from "../../../../client/src/lib/installWay.js";

test("the browser's own box first, then the iPhone steps, else nothing", () => {
  const way = (runsAsApp: boolean, hasPrompt: boolean, appleMobile: boolean) =>
    installWayOf({ runsAsApp, hasPrompt, appleMobile });
  expect(way(false, true, false)).toBe("prompt");
  expect(way(false, false, true)).toBe("ios");
  // Firefox on a laptop: no box, no steps
  expect(way(false, false, false)).toBeNull();
  // opened as the app already: never offered again
  expect(way(true, true, false)).toBeNull();
  expect(way(true, false, true)).toBeNull();
});

test("iPhones, and iPads that call themselves Macs, are told the steps", () => {
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  const ipadAsMac =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
  expect(isAppleMobile(iphone, 5)).toBe(true);
  expect(isAppleMobile(ipadAsMac, 5)).toBe(true);
  // a real Mac has no touch screen
  expect(isAppleMobile(ipadAsMac, 0)).toBe(false);
  expect(isAppleMobile("Mozilla/5.0 (Linux; Android 14) Chrome/131", 5)).toBe(
    false,
  );
});
