// Whether this device can have alerts, and what Settings shows
// (client/src/lib/alertsWay.ts)
import { alertsWayOf, keyBytes } from "../../../../client/src/lib/alertsWay.js";

const device = {
  keyed: true,
  hasPush: true,
  appleMobile: false,
  runsAsApp: false,
  permission: "default" as const,
  subscribed: false,
};

test("what the setting shows on each kind of device", () => {
  expect(alertsWayOf(device)).toBe("off");
  expect(
    alertsWayOf({ ...device, permission: "granted", subscribed: true }),
  ).toBe("on");
  // allowed, but the subscription is gone (cleared by the browser): off
  expect(alertsWayOf({ ...device, permission: "granted" })).toBe("off");
  expect(alertsWayOf({ ...device, permission: "denied" })).toBe("blocked");
  expect(alertsWayOf({ ...device, hasPush: false })).toBe("unsupported");
  // an iPhone in Safari: the app first. In the app, the switch
  expect(alertsWayOf({ ...device, appleMobile: true, hasPush: false })).toBe(
    "installFirst",
  );
  expect(alertsWayOf({ ...device, appleMobile: true, runsAsApp: true })).toBe(
    "off",
  );
  // not set up on the server: nothing at all
  expect(alertsWayOf({ ...device, keyed: false })).toBe("hidden");
});

test("the server's key, as the bytes the browser wants", () => {
  // "AQID_-8" is bytes 1, 2, 3, 255, 239 in URL-safe base64
  expect([...keyBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
});
