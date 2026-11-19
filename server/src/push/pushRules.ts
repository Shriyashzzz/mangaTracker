// What becomes an alert on a reader's phone, and what it says. Pure, so it
// can be tested on its own (pushSender.ts sends them).
//
// The weekly email's news (digest/digestRules.ts), sooner and shorter: a
// volume or book out today or in the last two days, for a series they're
// caught up on, and a To buy volume clearly under its usual price. Never
// something coming (that's the email's), never one they've said "Seen it"
// to, and each once (a price again after a month, as the email).
import type { Digest, DropItem, ReleaseItem } from "../digest/digestRules.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// a release this many days old is still worth an alert
export const OUT_WITHIN_DAYS = 2;
// the most alerts one reader gets in one go: the rest are one alert saying
// how many more
export const MOST_AT_ONCE = 3;

export type Alert = {
  // the items it tells of, for digest_items ("push:out:812:15")
  keys: string[];
  title: string;
  body: string;
  // the site's page it opens
  url: string;
  // alerts with the same tag replace each other on the phone
  tag: string;
};

// The push services browsers use. A device's address is only ever sent to
// if it's one of theirs: anything else could be an address inside our own
// network, made to look like a device
const PUSH_SERVICES = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];
export function isPushService(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port) return false;
  return PUSH_SERVICES.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

const daysAgo = (day: string, today: string) =>
  Math.round((Date.parse(today) - Date.parse(day)) / DAY_MS);

const money = (cents: number, country: "us" | "ca") =>
  `${country === "ca" ? "CA$" : "$"}${(cents / 100).toFixed(2)}`;

function releaseAlert(item: ReleaseItem, today: string): Alert {
  const ago = daysAgo(item.day, today);
  const when =
    ago === 0 ? "Out today." : ago === 1 ? "Out yesterday." : "Just out.";
  return {
    keys: [`push:${item.key}`],
    title: `${item.series} ${item.book} is out`,
    body: `${when} Tap to see where to buy it.`,
    url: `/details/${item.mangaId}`,
    tag: `out-${item.mangaId}`,
  };
}

function dropAlert(item: DropItem, country: "us" | "ca"): Alert {
  return {
    keys: [`push:${item.key}`],
    title: `${item.title}: ${money(item.cents, country)}`,
    body: `At ${item.store}. Usually ${money(item.usualCents, country)}.`,
    url: `/prices/${item.isbn13}`,
    tag: `drop-${item.isbn13}`,
  };
}

// a reader's alerts, from their news less what's been sent before
export function alertsFrom(
  news: Digest,
  today: string,
  country: "us" | "ca" = "us",
): Alert[] {
  const out = news.out.filter(
    (item) => daysAgo(item.day, today) <= OUT_WITHIN_DAYS,
  );
  const alerts = [
    ...out.map((item) => releaseAlert(item, today)),
    ...news.drops.map((item) => dropAlert(item, country)),
  ];
  if (alerts.length <= MOST_AT_ONCE) return alerts;
  // a busy day: the first ones, and one for the rest
  const shown = alerts.slice(0, MOST_AT_ONCE - 1);
  const rest = alerts.slice(MOST_AT_ONCE - 1);
  return [
    ...shown,
    {
      keys: rest.flatMap((alert) => alert.keys),
      title: `${rest.length} more for your shelf`,
      body: "New volumes and lower prices. Tap to see them.",
      url: "/new-releases",
      tag: "more",
    },
  ];
}

// what the phone is sent: the alert, as its service worker reads it
// (client public/sw.js "push")
export const payloadOf = (alert: Alert) =>
  JSON.stringify({
    title: alert.title,
    body: alert.body,
    url: alert.url,
    tag: alert.tag,
  });
