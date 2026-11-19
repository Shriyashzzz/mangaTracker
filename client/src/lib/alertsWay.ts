// Whether this device can have alerts, and what the setting shows. Pure, so
// the server's Jest can test it (lib/alerts.ts reads the browser).
//
//   hidden        alerts aren't set up on this site (no key): nothing shown
//   unsupported   this browser can't show them
//   installFirst  an iPhone or iPad in Safari: alerts only work in the
//                 installed app (iOS 16.4 and later)
//   blocked       the reader said no to the browser's question before:
//                 only the browser's own settings can undo that
//   off / on      the switch
export type AlertsWay =
  "hidden" | "unsupported" | "installFirst" | "blocked" | "off" | "on";

export function alertsWayOf(device: {
  keyed: boolean;
  hasPush: boolean;
  appleMobile: boolean;
  runsAsApp: boolean;
  permission: "default" | "granted" | "denied";
  subscribed: boolean;
}): AlertsWay {
  if (!device.keyed) return "hidden";
  // an iPhone's Safari has no push at all; the installed app does
  if (device.appleMobile && !device.runsAsApp) return "installFirst";
  if (!device.hasPush) return "unsupported";
  if (device.permission === "denied") return "blocked";
  return device.subscribed && device.permission === "granted" ? "on" : "off";
}

// the key as the browser wants it: the URL-safe base64 the server sends,
// as bytes
export function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
