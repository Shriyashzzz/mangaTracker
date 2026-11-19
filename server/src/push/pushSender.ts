// Sends alerts to readers' phones: once an hour in North America's daytime
// it looks at each reader with a device switched on, and sends what's new
// for them (pushRules.ts) to every device of theirs. Each alert once: its
// items go in digest_items, as the weekly email's do.
//
// Runs on the live site only, unless PUSH_ALERTS=on; PUSH_ALERTS=off stops
// it anywhere; and never without the VAPID key pair (config.ts).
import * as webPush from "web-push";
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { startEvery, triedLately } from "../collector/fillShared.js";
import { newsFor, PUSH_PREFIX } from "../digest/digestData.js";
import { withoutSent } from "../digest/digestRules.js";
import type { Prefs } from "../models/userQueries.js";
import { alertsFrom, payloadOf } from "./pushRules.js";

const HOUR_MS = 60 * 60_000;
// 9am Eastern to 4pm Pacific, as the weekly email
const FIRST_HOUR_UTC = 14;
// an alert the phone hasn't picked up in a day isn't news any more
const KEEP_FOR_SECONDS = 24 * 60 * 60;

// The key pair, given to the push library: false when there's none, or
// it's wrong (the library checks it; a wrong one is said once in the log,
// and alerts stay off, rather than failing on every run)
let keysFor: string | null = null;
let keysGood = false;
export function pushKeysSet() {
  const pair = `${config.VAPID_PUBLIC_KEY ?? ""}|${config.VAPID_PRIVATE_KEY ?? ""}`;
  if (pair === keysFor) return keysGood;
  keysFor = pair;
  keysGood = false;
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  try {
    webPush.setVapidDetails(
      config.VAPID_SUBJECT ?? "https://mangatracker.xyz",
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    );
    keysGood = true;
  } catch (e) {
    console.error("VAPID keys are wrong, so no alerts:", (e as Error).message);
  }
  return keysGood;
}

export const pushSwitchOn = () =>
  pushKeysSet() &&
  config.PUSH_ALERTS !== "off" &&
  (config.PUSH_ALERTS === "on" || config.ENV === "PROD");

type Send = typeof webPush.sendNotification;
const realSend: Send = (subscription, payload, options) =>
  webPush.sendNotification(subscription, payload, options);

// readers with nothing to say, or whose alerts failed: left for a while
const looked = triedLately(3 * HOUR_MS);
export const forgetLookedForAlerts = () => looked.clear();

// One run: up to `most` alerts sent. What happened comes back, for the log
// and the tests. `send` is the push library's, or a test's
export async function sendDueAlerts(
  now = new Date(),
  most = config.PUSH_PER_RUN,
  send: Send = realSend,
) {
  if (!pushKeysSet()) return { readers: 0, sent: 0, gone: 0, failed: 0 };
  const devices = await prisma.pushSubscription.findMany({
    orderBy: { id: "asc" },
    include: { user: { select: { id: true, prefs: true } } },
  });
  const byUser = new Map<number, typeof devices>();
  for (const device of devices)
    byUser.set(device.userId, [...(byUser.get(device.userId) ?? []), device]);

  const today = now.toISOString().slice(0, 10);
  let sent = 0;
  let gone = 0;
  let failed = 0;
  for (const theirs of byUser.values()) {
    if (sent >= most) break;
    const user = theirs[0]!.user;
    const key = String(user.id);
    if (!looked.isDue(key, now.getTime())) continue;
    looked.mark(key, now.getTime());

    const { news, told } = await newsFor(user, now);
    // what alerts have told them, without the "push:" in front
    const toldByAlert = told
      .filter((t) => t.item.startsWith(PUSH_PREFIX))
      .map((t) => ({ ...t, item: t.item.slice(PUSH_PREFIX.length) }));
    const country =
      (user.prefs as Prefs | null)?.country === "ca" ? "ca" : "us";
    const alerts = alertsFrom(
      withoutSent(news, toldByAlert, now),
      today,
      country,
    );

    for (const alert of alerts) {
      if (sent >= most) break;
      let reached = false;
      for (const device of theirs) {
        try {
          await send(
            {
              endpoint: device.endpoint,
              keys: { p256dh: device.p256dh, auth: device.auth },
            },
            payloadOf(alert),
            { TTL: KEEP_FOR_SECONDS, urgency: "normal", timeout: 10_000 },
          );
          reached = true;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // the device switched alerts off, or the app was removed: its
          // address is no good, and goes
          if (status === 404 || status === 410) {
            await prisma.pushSubscription
              .delete({ where: { id: device.id } })
              .catch(() => {});
            gone++;
          } else {
            failed++;
            console.error(`alert for user ${user.id} failed:`, status ?? e);
          }
        }
      }
      if (!reached) continue;
      sent++;
      // told: not sent again (a price again after a month, as the email)
      await prisma.$transaction([
        prisma.digestItem.deleteMany({
          where: { userId: user.id, item: { in: alert.keys } },
        }),
        prisma.digestItem.createMany({
          data: alert.keys.map((item) => ({
            userId: user.id,
            item,
            sentAt: now,
          })),
        }),
      ]);
    }
  }
  return { readers: byUser.size, sent, gone, failed };
}

export function startAlertSender() {
  if (!pushSwitchOn()) return;
  startEvery(
    "phone alerts",
    async () => {
      if (new Date().getUTCHours() < FIRST_HOUR_UTC) return;
      const result = await sendDueAlerts();
      if (result.sent || result.failed || result.gone)
        console.log(
          `phone alerts: ${result.sent} sent, ${result.failed} failed, ${result.gone} devices gone`,
        );
    },
    { everyMs: HOUR_MS, firstAfterMs: 12 * 60_000 },
  );
}
