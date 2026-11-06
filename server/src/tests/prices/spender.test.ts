// Who a SerpApi search is counted against. No database and no real search:
// the request is a stand-in with just what spenderOf reads
import type { Request } from "express";
import {
  asSpender,
  currentSpender,
  spenderOf,
  visitorId,
} from "../../prices/spender.js";

const request = (userId: number | undefined, ip: string, userAgent?: string) =>
  ({
    session: { userId },
    ip,
    get: (name: string) => (name === "user-agent" ? userAgent : undefined),
  }) as unknown as Request;

test("a visitor's id is the same each time, and gives nothing away", () => {
  const id = visitorId("1.2.3.4", "Firefox", "s");
  expect(id).toMatch(/^[0-9a-f]{16}$/);
  expect(visitorId("1.2.3.4", "Firefox", "s")).toBe(id);
  expect(id).not.toContain("1.2.3.4");
  // another IP, browser or server secret is someone else
  expect(visitorId("1.2.3.5", "Firefox", "s")).not.toBe(id);
  expect(visitorId("1.2.3.4", "Safari", "s")).not.toBe(id);
  expect(visitorId("1.2.3.4", "Firefox", "t")).not.toBe(id);
});

test("signed in is counted by account, anyone else by visitor", () => {
  expect(spenderOf(request(7, "1.2.3.4", "Firefox"))).toEqual({ userId: 7 });
  const guest = spenderOf(request(undefined, "1.2.3.4", "Firefox"));
  expect(guest).toEqual({
    visitor: visitorId("1.2.3.4", "Firefox", process.env.SECRET!),
    userAgent: "Firefox",
  });
  // no browser named, and a very long one kept to the column's size
  expect(spenderOf(request(undefined, "1.2.3.4"))).toMatchObject({
    userAgent: null,
  });
  const long = spenderOf(request(undefined, "1.2.3.4", "x".repeat(500)));
  expect("userAgent" in long && long.userAgent?.length).toBe(300);
});

test("a search is put down to the visitor whose lookup it ran in", async () => {
  expect(currentSpender()).toBeNull();
  const seen: unknown[] = [];
  const lookup = async () => {
    await new Promise((r) => setTimeout(r, 5));
    seen.push(currentSpender());
  };
  // two at once never get mixed up, even across waits
  await Promise.all([
    asSpender({ userId: 1 }, lookup),
    asSpender({ visitor: "abc", userAgent: null }, lookup),
  ]);
  expect(seen).toContainEqual({ userId: 1 });
  expect(seen).toContainEqual({ visitor: "abc", userAgent: null });
  expect(currentSpender()).toBeNull();
});
