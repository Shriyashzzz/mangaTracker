// The Collector tier's rules alone (src/plan/planRules.ts)
import {
  entitlements,
  hasRoom,
  isLimited,
  limitedPlatforms,
  planOf,
} from "../../plan/planRules.js";

const day = 24 * 60 * 60 * 1000;
const now = new Date();
const used = { series: 0, scans: 0, priceAlerts: 0 };

test("a paid plan counts until it runs out, then it's free", () => {
  expect(
    planOf({ plan: "collector", planUntil: new Date(+now + day) }, now),
  ).toBe("collector");
  expect(
    planOf({ plan: "collector", planUntil: new Date(+now - day) }, now),
  ).toBe("free");
  expect(planOf({ plan: "free", planUntil: null }, now)).toBe("free");
});

test("an early member is never limited, wherever the limits are on", () => {
  const everywhere = limitedPlatforms("ios,android,web");
  expect(
    isLimited(
      planOf({ plan: "early", planUntil: null }, now),
      "ios",
      everywhere,
    ),
  ).toBe(false);
});

test("the limits hold only where they're switched on", () => {
  const iosOnly = limitedPlatforms(" iOS , nonsense ");
  expect([...iosOnly]).toEqual(["ios"]);
  expect(isLimited("free", "ios", iosOnly)).toBe(true);
  expect(isLimited("free", "android", iosOnly)).toBe(false);
  expect(isLimited("free", "web", iosOnly)).toBe(false);
  // nothing set: nowhere
  expect(isLimited("free", "ios", limitedPlatforms(undefined))).toBe(false);
  expect(isLimited("collector", "ios", iosOnly)).toBe(false);
});

test("room: up to each limit, never past it, and always when not limited", () => {
  const free = (over: Partial<typeof used>) =>
    entitlements("free", true, { ...used, ...over });
  expect(hasRoom(free({ series: 99 }), "series")).toBe(true);
  expect(hasRoom(free({ series: 100 }), "series")).toBe(false);
  expect(hasRoom(free({ scans: 79 }), "scans")).toBe(true);
  expect(hasRoom(free({ scans: 80 }), "scans")).toBe(false);
  expect(hasRoom(free({ priceAlerts: 3 }), "priceAlerts")).toBe(false);
  // a shelf already past the limit keeps everything; it only can't grow
  expect(hasRoom(free({ series: 250 }), "series")).toBe(false);
  expect(
    hasRoom(entitlements("free", false, { ...used, series: 250 }), "series"),
  ).toBe(true);
});

test("Collector's extras are open whenever nothing is limited", () => {
  expect(entitlements("free", true, used)).toMatchObject({
    soonAlerts: false,
    calendar: false,
    japan: false,
    limits: { series: 100, scans: 80, priceAlerts: 3 },
  });
  expect(entitlements("collector", false, used)).toMatchObject({
    soonAlerts: true,
    calendar: true,
    japan: true,
    limits: null,
  });
});
