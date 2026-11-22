// The phone app's alerts. A phone with the app registers an Expo push token
// in place of a browser's push address; it's kept in push_subscriptions as
// the device's "endpoint" (with no keys: those are web push's), and sent to
// through Expo's push service, which hands it on to Google's or Apple's.
// What is sent and when is the same as for a browser (pushSender.ts)
import type { Alert } from "./pushRules.js";

const EXPO_SEND = "https://exp.host/--/api/v2/push/send";
// an alert the phone hasn't picked up in a day isn't news any more
const KEEP_FOR_SECONDS = 24 * 60 * 60;

// "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", as the app gets it from Expo
export const isExpoToken = (token: string) =>
  /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/.test(token);

// "gone": the app was removed or its alerts switched off, so the token is
// no good and goes. Anything else that isn't "sent" throws
export type ExpoSend = (
  token: string,
  alert: Alert,
) => Promise<"sent" | "gone">;

type Ticket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

export const sendToExpo: ExpoSend = async (token, alert) => {
  const res = await fetch(EXPO_SEND, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to: token,
      title: alert.title,
      body: alert.body,
      // the app opens this page on a tap
      data: { url: alert.url },
      // the app's Android channel (its lib/phoneAlerts.ts)
      channelId: "releases",
      ttl: KEEP_FOR_SECONDS,
      priority: "normal",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Expo push answered ${res.status}`);
  const { data } = (await res.json()) as { data?: Ticket | Ticket[] };
  const ticket = Array.isArray(data) ? data[0] : data;
  if (ticket?.status === "ok") return "sent";
  if (ticket?.details?.error === "DeviceNotRegistered") return "gone";
  throw new Error(ticket?.message ?? "Expo push failed");
};
