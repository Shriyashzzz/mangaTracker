// What becomes an alert on a phone (src/push/pushRules.ts)
import {
  alertedToday,
  alertsFrom,
  arrivedBooks,
  isPushService,
  MOST_AT_ONCE,
  payloadOf,
  targetHits,
  withoutTold,
  type PushNews,
  type ToBuyBook,
} from "../../push/pushRules.js";
import type { ReleaseItem } from "../../digest/digestRules.js";

const today = "2026-11-19";
const out = (over: Partial<ReleaseItem>): ReleaseItem => ({
  key: "out:7:3",
  kind: "out",
  mangaId: 7,
  series: "Blue Box",
  book: "Vol. 3",
  day: today,
  ...over,
});
const drop = {
  key: "drop:9781421520544",
  kind: "drop" as const,
  isbn13: "9781421520544",
  title: "Vagabond, Vol. 12",
  cents: 1099,
  usualCents: 1499,
  store: "Books-A-Million",
};
const empty: PushNews = {
  out: [],
  soon: [],
  drops: [],
  ahead: [],
  arrived: [],
  targets: [],
};

test("only the browsers' own push services are ever sent to", () => {
  expect(isPushService("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
  expect(isPushService("https://web.push.apple.com/QGx")).toBe(true);
  expect(
    isPushService("https://updates.push.services.mozilla.com/wpush/v2/x"),
  ).toBe(true);
  expect(isPushService("https://wns2-by3p.notify.windows.com/w/?token=x")).toBe(
    true,
  );
  // our own network, plain http, an odd port, a look-alike, not a URL
  expect(isPushService("http://mangatracker.railway.internal:8080/api")).toBe(
    false,
  );
  expect(isPushService("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
  expect(isPushService("https://fcm.googleapis.com:8443/x")).toBe(false);
  expect(isPushService("https://fcm.googleapis.com.evil.example/x")).toBe(
    false,
  );
  expect(isPushService("https://evilpush.apple.com.example/x")).toBe(false);
  expect(isPushService("not a url")).toBe(false);
});

test("a release out today or lately is an alert; an older one, or one far off, isn't", () => {
  const alerts = alertsFrom(
    {
      ...empty,
      out: [
        out({}),
        out({
          key: "out:8:9",
          mangaId: 8,
          series: "Dandadan",
          book: "Vol. 9",
          day: "2026-11-18",
        }),
        // a week old: the email's, not an alert
        out({ key: "out:9:2", mangaId: 9, day: "2026-11-12" }),
      ],
      // twelve days off: not yet
      soon: [out({ key: "soon:7:4", kind: "soon", day: "2026-12-01" })],
    },
    today,
  );
  expect(alerts.map((a) => [a.title, a.body, a.url])).toEqual([
    [
      "Blue Box Vol. 3 is out",
      "Out today. Tap to see where to buy it.",
      "/details/7",
    ],
    [
      "Dandadan Vol. 9 is out",
      "Out yesterday. Tap to see where to buy it.",
      "/details/8",
    ],
  ]);
  expect(alerts[0]!.keys).toEqual(["push:out:7:3"]);
});

test("a price drop, in the reader's own money", () => {
  const [us] = alertsFrom({ ...empty, drops: [drop] }, today);
  expect([us!.title, us!.body, us!.url]).toEqual([
    "Vagabond, Vol. 12: $10.99",
    "At Books-A-Million. Usually $14.99.",
    "/prices/9781421520544",
  ]);
  const [ca] = alertsFrom({ ...empty, drops: [drop] }, today, "ca");
  expect(ca!.title).toBe("Vagabond, Vol. 12: CA$10.99");
});

test("a busy day: a few alerts, and one for the rest", () => {
  const many = Array.from({ length: 6 }, (_, i) =>
    out({ key: `out:${i}:1`, mangaId: i, series: `Series ${i}` }),
  );
  const alerts = alertsFrom({ ...empty, out: many }, today);
  expect(alerts).toHaveLength(MOST_AT_ONCE);
  const last = alerts.at(-1)!;
  expect(last.title).toBe("4 more for your shelf");
  expect(last.url).toBe("/new-releases");
  // every item is told, the summed ones too
  expect(alerts.flatMap((a) => a.keys)).toHaveLength(6);
});

test("what the phone is sent", () => {
  const [alert] = alertsFrom({ ...empty, out: [out({})] }, today);
  expect(JSON.parse(payloadOf(alert!))).toEqual({
    title: "Blue Box Vol. 3 is out",
    body: "Out today. Tap to see where to buy it.",
    url: "/details/7",
    tag: "out-7",
  });
});

test("a volume coming within a week is an alert, once it's near", () => {
  const alerts = alertsFrom(
    {
      ...empty,
      soon: [
        out({
          key: "soon:7:4",
          kind: "soon",
          book: "Vol. 4",
          day: "2026-11-24",
        }),
        out({ key: "soon:8:10", kind: "soon", mangaId: 8, day: "2026-11-20" }),
        // a month off: not yet
        out({ key: "soon:9:3", kind: "soon", mangaId: 9, day: "2026-12-20" }),
      ],
    },
    today,
  );
  expect(alerts.map((a) => [a.title, a.body])).toEqual([
    [
      "Blue Box Vol. 4 comes out in 5 days",
      "Tuesday, Nov 24. Tap to see where to buy it.",
    ],
    [
      "Blue Box Vol. 3 comes out tomorrow",
      "Friday, Nov 20. Tap to see where to buy it.",
    ],
  ]);
  // "up for preorder" counts as told by it too
  expect(alerts[0]!.keys).toEqual(["push:soon:7:4", "push:preorder:7:4"]);
});

// ---------- the alerts that are only alerts ----------
const DAY_MS = 24 * 60 * 60 * 1000;
const dayFrom = (offset: number) =>
  new Date(Date.parse(today) + offset * DAY_MS).toISOString().slice(0, 10);
const coming = (
  days: number,
  over: Partial<ReleaseItem> = {},
): ReleaseItem => ({
  key: "soon:7:4",
  kind: "soon",
  mangaId: 7,
  series: "Blue Box",
  book: "Vol. 4",
  day: dayFrom(days),
  ...over,
});
const noon = new Date(`${today}T12:00:00Z`);
const book = (over: Partial<ToBuyBook>): ToBuyBook => ({
  isbn13: "9781421520544",
  title: "Vagabond, Vol. 12",
  addedAt: new Date(Date.parse(today) - 30 * DAY_MS),
  published: null,
  alertCents: null,
  new: null,
  used: null,
  ...over,
});
const copy = (cents: number, daysOld = 0) => ({
  cents,
  store: "eBay",
  checkedAt: new Date(noon.getTime() - daysOld * DAY_MS),
});

test("a next book with a day far off is up for preorder, once", () => {
  const news = { ...empty, ahead: [coming(40)] };
  const [alert, ...rest] = alertsFrom(news, today);
  expect(rest).toEqual([]);
  expect(alert).toMatchObject({
    keys: ["push:preorder:7:4"],
    title: "Blue Box Vol. 4 is up for preorder",
    url: "/details/7",
  });
  // told: not again, however long it stays ahead
  const told = [{ item: "preorder:7:4", sentAt: noon }];
  expect(alertsFrom(withoutTold(news, told, noon), today)).toEqual([]);
});

test("a book a week off is one alert, not a preorder alert as well", () => {
  const near = coming(3);
  const alerts = alertsFrom({ ...empty, soon: [near], ahead: [near] }, today);
  expect(alerts).toHaveLength(1);
  expect(alerts[0]!.title).toBe("Blue Box Vol. 4 comes out in 3 days");
  // and it counts as the preorder told, so that never follows
  expect(alerts[0]!.keys).toEqual(["push:soon:7:4", "push:preorder:7:4"]);
});

test("a copy at or under the price they named is an alert, new or used", () => {
  const hits = targetHits(
    [
      book({ alertCents: 1000, new: copy(1499), used: copy(900) }),
      // not down to their price
      book({ isbn13: "9781421520551", alertCents: 500, new: copy(1499) }),
      // a price nobody has checked lately isn't quoted
      book({ isbn13: "9781421520568", alertCents: 2000, new: copy(1499, 9) }),
      // no price named
      book({ isbn13: "9781421520575", new: copy(100) }),
    ],
    noon,
  );
  expect(hits).toEqual([
    {
      key: "target:9781421520544:1000",
      isbn13: "9781421520544",
      title: "Vagabond, Vol. 12",
      cents: 900,
      targetCents: 1000,
      store: "eBay",
      used: true,
    },
  ]);
  const [alert] = alertsFrom({ ...empty, targets: hits }, today);
  expect(alert).toMatchObject({
    title: "Vagabond, Vol. 12: $9.00",
    body: "Used, at eBay. Under your $10.00.",
    url: "/prices/9781421520544",
  });
});

test("their price beats the plain drop: one alert for the book, and the drop counts as told", () => {
  const targets = targetHits(
    [book({ alertCents: 1200, new: copy(1099) })],
    noon,
  );
  const alerts = alertsFrom({ ...empty, drops: [drop], targets }, today);
  expect(alerts).toHaveLength(1);
  expect(alerts[0]!.keys).toEqual([
    "push:target:9781421520544:1200",
    "push:drop:9781421520544",
  ]);
  // told at this price: silent, until they name another
  const told = [{ item: "target:9781421520544:1200", sentAt: noon }];
  expect(withoutTold({ ...empty, targets }, told, noon).targets).toEqual([]);
  // a month on, the same price is news again
  const nextMonth = new Date(noon.getTime() + 29 * DAY_MS);
  expect(
    withoutTold({ ...empty, targets }, told, nextMonth).targets,
  ).toHaveLength(1);
  const lower = targetHits([book({ alertCents: 1150, new: copy(1099) })], noon);
  expect(
    withoutTold({ ...empty, targets: lower }, told, noon).targets,
  ).toHaveLength(1);
});

test("a To buy volume they were waiting on, out now", () => {
  const waited = book({ published: today });
  expect(arrivedBooks([waited], today)).toEqual([
    {
      key: "arrived:9781421520544",
      isbn13: "9781421520544",
      title: "Vagabond, Vol. 12",
      day: today,
    },
  ]);
  const [alert] = alertsFrom(
    { ...empty, arrived: arrivedBooks([waited], today) },
    today,
  );
  expect(alert).toMatchObject({
    title: "Vagabond, Vol. 12 is out",
    body: "Out today. It's on your To buy list.",
  });
  // put on the list after it came out, out long ago, still to come, or
  // with no day in full: nothing to tell
  expect(
    arrivedBooks(
      [
        book({ published: dayFrom(-1), addedAt: noon }),
        book({ published: dayFrom(-10) }),
        book({ published: dayFrom(5) }),
        book({ published: today.slice(0, 7) }),
      ],
      today,
    ),
  ).toEqual([]);
});

test("a book on both the shelf and To buy is told once, as the shelf's", () => {
  const arrived = arrivedBooks([book({ published: today })], today);
  const alerts = alertsFrom(
    { ...empty, out: [out({ isbn13: "9781421520544" })], arrived },
    today,
  );
  expect(alerts).toHaveLength(1);
  expect(alerts[0]!.title).toBe("Blue Box Vol. 3 is out");
  expect(alerts[0]!.keys).toEqual([
    "push:out:7:3",
    "push:arrived:9781421520544",
  ]);
});

test("one batch a day", () => {
  const earlier = new Date(`${today}T14:05:00Z`);
  expect(alertedToday([{ item: "out:7:3", sentAt: earlier }], today)).toBe(
    true,
  );
  expect(alertedToday([{ item: "out:7:3", sentAt: earlier }], dayFrom(1))).toBe(
    false,
  );
  // what was marked on the first look at their preorders never counts
  expect(
    alertedToday([{ item: "preorder:seen", sentAt: new Date(0) }], today),
  ).toBe(false);
});
