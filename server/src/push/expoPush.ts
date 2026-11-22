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
  // what to ask Expo's receipts for later
  id?: string;
  message?: string;
  details?: { error?: string };
};

// Expo answers a send in two steps: a ticket at once, and a receipt some
// minutes later saying whether Google or Apple took it. "This phone no
// longer has the app" mostly comes in the receipt, so each ticket is kept
// (in memory: a restart only puts the answer off to the next alert) and
// asked about on a later run
const EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";
// receipts are ready after about this long, and Expo keeps them a day
const RECEIPT_READY_MS = 15 * 60_000;
const RECEIPT_KEPT_MS = 24 * 60 * 60_000;
const MOST_PER_ASK = 300;
const tickets = new Map<string, { token: string; at: number }>();
export const forgetExpoTickets = () => tickets.clear();
export const noteExpoTicket = (id: string, token: string, at: number) =>
  tickets.set(id, { token, at });

type Receipt = { status?: string; details?: { error?: string } };
export type ExpoGone = (now?: Date) => Promise<string[]>;

// the phones whose receipts say the app is gone: their tokens, to forget.
// A ticket asked about is done with either way
export const expoTokensGone: ExpoGone = async (now = new Date()) => {
  const at = now.getTime();
  for (const [id, ticket] of tickets)
    if (at - ticket.at > RECEIPT_KEPT_MS) tickets.delete(id);
  const ready = [...tickets]
    .filter(([, ticket]) => at - ticket.at >= RECEIPT_READY_MS)
    .slice(0, MOST_PER_ASK);
  if (!ready.length) return [];
  const res = await fetch(EXPO_RECEIPTS, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids: ready.map(([id]) => id) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Expo receipts answered ${res.status}`);
  const { data } = (await res.json()) as { data?: Record<string, Receipt> };
  const gone: string[] = [];
  for (const [id, ticket] of ready) {
    const receipt = data?.[id];
    // not ready yet: asked again next run
    if (!receipt) continue;
    tickets.delete(id);
    if (receipt.details?.error === "DeviceNotRegistered")
      gone.push(ticket.token);
  }
  return [...new Set(gone)];
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
  if (ticket?.status === "ok") {
    if (ticket.id) noteExpoTicket(ticket.id, token, Date.now());
    return "sent";
  }
  if (ticket?.details?.error === "DeviceNotRegistered") return "gone";
  throw new Error(ticket?.message ?? "Expo push failed");
};
