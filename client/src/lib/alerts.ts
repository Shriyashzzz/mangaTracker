// Alerts on this device: a volume out for the shelf on the day it's out,
// and price drops on the To buy list (server src/push/). Switched on per
// device, in Settings; the browser's own question is only ever asked
// after the reader taps the switch. alertsWay.ts says what the setting
// shows.
import { apiFetch, getJson } from "./api";
import { alertsWayOf, keyBytes, type AlertsWay } from "./alertsWay";
import { runsAsApp } from "./install";
import { isAppleMobile } from "./installWay";

const hasPush = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// this device's subscription with the browser's push service, if any
async function currentSubscription() {
  if (!hasPush()) return null;
  const worker = await navigator.serviceWorker.getRegistration();
  return (await worker?.pushManager.getSubscription()) ?? null;
}

// the server's key; null when alerts aren't set up there
const serverKey = () =>
  getJson<{ publicKey: string }>("/api/push/key")
    .then((answer) => answer.publicKey)
    .catch(() => null);

export async function alertsWay(): Promise<AlertsWay> {
  const [key, subscription] = await Promise.all([
    serverKey(),
    currentSubscription().catch(() => null),
  ]);
  return alertsWayOf({
    keyed: Boolean(key),
    hasPush: hasPush(),
    appleMobile: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints),
    runsAsApp: runsAsApp(),
    permission: hasPush() ? Notification.permission : "default",
    subscribed: Boolean(subscription),
  });
}

// On: the browser's question, then a subscription with its push service,
// then saved on the server for this reader. What it came to
export async function switchAlertsOn(): Promise<AlertsWay | "failed"> {
  const key = await serverKey();
  if (!key || !hasPush()) return "failed";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  try {
    const worker = await navigator.serviceWorker.ready;
    const subscription =
      (await worker.pushManager.getSubscription()) ??
      (await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }));
    const res = await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: subscription.toJSON(),
    });
    return res.ok ? "on" : "failed";
  } catch {
    return "failed";
  }
}

// Off for this device: on the server (while still signed in) and with the
// browser's push service. Also on signing out, so the next reader on this
// device never gets the last one's alerts
export async function switchAlertsOff() {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  await apiFetch("/api/push/unsubscribe", {
    method: "POST",
    body: { endpoint: subscription.endpoint },
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => false);
}

// The number on the installed app's icon: the New tab's count, like a
// native app's unread count. Only in the app, where the icon is
export function showOnIcon(count: number) {
  if (!runsAsApp()) return;
  const badge = navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void badge.setAppBadge?.(count).catch(() => {});
  else void badge.clearAppBadge?.().catch(() => {});
}
