// What becomes an alert on a phone (src/push/pushRules.ts)
import {
  alertsFrom,
  isPushService,
  MOST_AT_ONCE,
  payloadOf,
} from "../../push/pushRules.js";
import type { Digest, ReleaseItem } from "../../digest/digestRules.js";

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
const empty: Digest = { out: [], soon: [], drops: [] };

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
  expect(alerts[0]!.keys).toEqual(["push:soon:7:4"]);
});
