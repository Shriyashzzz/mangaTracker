// What becomes an alert on a reader's phone, and what it says. Pure, so it
// can be tested on its own (pushSender.ts sends them).
//
// The weekly email's news (digest/digestRules.ts), sooner and shorter, and
// three kinds that are only ever alerts:
//   out       a volume or book out today or in the last two days, for a
//             series they're caught up on
//   coming    one coming within a week
//   preorder  their next book has just been given a day, further off than
//             that ("is up for preorder"): once a book
//   drop      a To buy volume clearly under its usual price
//   target    a To buy volume at or under the price they named
//   arrived   a To buy volume they were waiting on is out
//
// No spam is the rule everything here bends to: each thing is said once (a
// price again after a month), one book is never two alerts on one day, a
// reader gets one batch of alerts a day and at most three in it, and never
// one they've said "Seen it" to.
import {
  DROP_AGAIN_DAYS,
  PRICE_FRESH_DAYS,
  withoutSent,
  type Digest,
  type DropItem,
  type ReleaseItem,
} from "../digest/digestRules.js";

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

// a To buy volume they were waiting on, out now
export type ArrivedItem = {
  key: string;
  isbn13: string;
  title: string;
  // the day it came out
  day: string;
};
// a To buy volume at or under the price they named
export type TargetItem = {
  key: string;
  isbn13: string;
  title: string;
  cents: number;
  targetCents: number;
  store: string;
  used: boolean;
};
// what a reader's alerts start from: the email's news, and the three kinds
// that are only alerts
export type PushNews = Digest & {
  // every next book of theirs with a day, however far off
  ahead: ReleaseItem[];
  arrived: ArrivedItem[];
  targets: TargetItem[];
};

// a volume on their To buy list, with what the two rules below need
export type ToBuyBook = {
  isbn13: string;
  title: string;
  addedAt: Date;
  // its release day as the saved list has it; null when nobody knows
  published: string | null;
  // the price they named, if any
  alertCents: number | null;
  new: { cents: number; store: string; checkedAt: Date } | null;
  used: { cents: number; store: string; checkedAt: Date } | null;
};

const fullDay = (published: string | null) =>
  /^\d{4}-\d{2}-\d{2}$/.test(published ?? "") ? published! : null;

// To buy volumes that were put on the list before they came out, and came
// out today or in the last two days. One added after its release was never
// waited on: nothing to tell
export function arrivedBooks(books: ToBuyBook[], today: string): ArrivedItem[] {
  return books.flatMap((book) => {
    const day = fullDay(book.published);
    if (!day || day > today) return [];
    if (daysAgo(day, today) > OUT_WITHIN_DAYS) return [];
    if (book.addedAt.toISOString().slice(0, 10) >= day) return [];
    return [
      {
        key: `arrived:${book.isbn13}`,
        isbn13: book.isbn13,
        title: book.title,
        day,
      },
    ];
  });
}

// To buy volumes with a copy at or under the price they named, new or used
// (they named the price: either kind is what they asked for). Only a price
// its store was asked lately. The key carries the price named, so naming a
// new one can be told again
export function targetHits(books: ToBuyBook[], now: Date): TargetItem[] {
  const freshSince = now.getTime() - PRICE_FRESH_DAYS * DAY_MS;
  return books.flatMap((book) => {
    const target = book.alertCents;
    if (target == null) return [];
    const copies = [
      book.new ? { ...book.new, used: false } : null,
      book.used ? { ...book.used, used: true } : null,
    ]
      .filter((copy) => copy !== null)
      .filter(
        (copy) =>
          copy.checkedAt.getTime() >= freshSince && copy.cents <= target,
      )
      .sort((a, b) => a.cents - b.cents);
    const best = copies[0];
    if (!best) return [];
    return [
      {
        key: `target:${book.isbn13}:${target}`,
        isbn13: book.isbn13,
        title: book.title,
        cents: best.cents,
        targetCents: target,
        store: best.store,
        used: best.used,
      },
    ];
  });
}

// "soon:812:15" as the preorder it once was: "preorder:812:15"
export const preorderKey = (item: ReleaseItem) =>
  `preorder:${item.key.slice(item.key.indexOf(":") + 1)}`;
// in digest_items once a reader's preorders have been looked at the first
// time (pushSender.ts): what was known before then is never sent as new
export const PREORDERS_SEEN = "preorder:seen";

// Less what alerts have told them already (`told`: their alert items, with
// no "push:" in front)
export function withoutTold(
  news: PushNews,
  told: { item: string; sentAt: Date }[],
  now: Date,
): PushNews {
  const sentAt = new Map(told.map((t) => [t.item, t.sentAt.getTime()]));
  // a price they named is told again only after a while, as a plain drop
  // is: the same sale isn't news twice, but next season's is
  const againAfter = now.getTime() - DROP_AGAIN_DAYS * DAY_MS;
  return {
    ...withoutSent(news, told, now),
    ahead: news.ahead.filter((item) => !sentAt.has(preorderKey(item))),
    arrived: news.arrived.filter((item) => !sentAt.has(item.key)),
    targets: news.targets.filter(
      (item) => (sentAt.get(item.key) ?? -Infinity) < againAfter,
    ),
  };
}

// One batch a day: a reader an alert went to today (UTC) hears no more
// until tomorrow, whatever else turns up
export const alertedToday = (
  told: { item: string; sentAt: Date }[],
  today: string,
) => told.some((t) => t.sentAt.toISOString().slice(0, 10) === today);

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

function targetAlert(item: TargetItem, country: "us" | "ca"): Alert {
  return {
    // the plain price drop for the same book is told by this too
    keys: [`push:${item.key}`, `push:drop:${item.isbn13}`],
    title: `${item.title}: ${money(item.cents, country)}`,
    body: `${item.used ? "Used, at" : "At"} ${item.store}. Under your ${money(item.targetCents, country)}.`,
    url: `/prices/${item.isbn13}`,
    tag: `drop-${item.isbn13}`,
  };
}

function arrivedAlert(item: ArrivedItem, today: string): Alert {
  const ago = daysAgo(item.day, today);
  const when =
    ago === 0 ? "Out today." : ago === 1 ? "Out yesterday." : "Just out.";
  return {
    keys: [`push:${item.key}`],
    title: `${item.title} is out`,
    body: `${when} It's on your To buy list.`,
    url: `/prices/${item.isbn13}`,
    tag: `out-${item.isbn13}`,
  };
}

// a book due in this many days is worth an alert of its own
export const SOON_WITHIN_DAYS = 7;

const DAY_WORDS = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function comingAlert(item: ReleaseItem, today: string): Alert {
  const days = -daysAgo(item.day, today);
  const when = days === 1 ? "tomorrow" : `in ${days} days`;
  return {
    // this close, "up for preorder" would be a second alert for one book:
    // it's told by this one
    keys: [`push:${item.key}`, `push:${preorderKey(item)}`],
    title: `${item.series} ${item.book} comes out ${when}`,
    body: `${DAY_WORDS.format(new Date(`${item.day}T00:00:00Z`))}. Tap to see where to buy it.`,
    url: `/details/${item.mangaId}`,
    tag: `soon-${item.mangaId}`,
  };
}

function preorderAlert(item: ReleaseItem): Alert {
  return {
    keys: [`push:${preorderKey(item)}`],
    title: `${item.series} ${item.book} is up for preorder`,
    body: `Out ${DAY_WORDS.format(new Date(`${item.day}T00:00:00Z`))}. Tap to see where to buy it.`,
    url: `/details/${item.mangaId}`,
    tag: `soon-${item.mangaId}`,
  };
}

// A reader's alerts, from their news less what's been sent before, the
// most pressing first (a busy day shows the first ones and counts the
// rest). One book is one alert: a To buy volume that's also their shelf's
// next is told as the shelf's, a price they named beats the plain drop, and
// a book a week off is "comes out", not "up for preorder" as well
export function alertsFrom(
  news: PushNews,
  today: string,
  country: "us" | "ca" = "us",
): Alert[] {
  const out = news.out.filter(
    (item) => daysAgo(item.day, today) <= OUT_WITHIN_DAYS,
  );
  const daysTo = (item: ReleaseItem) => -daysAgo(item.day, today);
  const soon = news.soon.filter(
    (item) => daysTo(item) >= 1 && daysTo(item) <= SOON_WITHIN_DAYS,
  );
  const preorders = news.ahead.filter(
    (item) => daysTo(item) > SOON_WITHIN_DAYS,
  );
  // the shelf's "is out" says it for the To buy list's copy of the book
  const outAlerts = out.map((item) => {
    const alert = releaseAlert(item, today);
    const same = news.arrived.find((a) => a.isbn13 === item.isbn13);
    return same
      ? { ...alert, keys: [...alert.keys, `push:${same.key}`] }
      : alert;
  });
  const outIsbns = new Set(out.map((item) => item.isbn13));
  const arrived = news.arrived.filter((item) => !outIsbns.has(item.isbn13));
  const named = new Set(news.targets.map((item) => item.isbn13));
  const drops = news.drops.filter((item) => !named.has(item.isbn13));
  const alerts = [
    ...outAlerts,
    ...news.targets.map((item) => targetAlert(item, country)),
    ...arrived.map((item) => arrivedAlert(item, today)),
    ...soon.map((item) => comingAlert(item, today)),
    ...drops.map((item) => dropAlert(item, country)),
    ...preorders.map(preorderAlert),
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
      body: "New and upcoming volumes, and lower prices. Tap to see them.",
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
