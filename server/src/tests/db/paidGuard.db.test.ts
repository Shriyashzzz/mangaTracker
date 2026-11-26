// The guard on paid searches (prices/spender.ts mayPay, prices/human.ts):
// only a visit Turnstile clearly passed may spend them, and one visitor at
// most PAID_A_DAY a day; Cloudflare out of reach still gets a free check
import config from "../../config/config.js";
import { humanCheck } from "../../prices/human.js";
import {
  asSpender,
  mayPay,
  notePaid,
  PAID_A_DAY,
  paidLabel,
} from "../../prices/spender.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const visitor = { visitor: "abcdef0123456789", userAgent: "Browser/1" };
const realFetch = globalThis.fetch;
const realSecret = config.TURNSTILE_SECRET_KEY;

beforeEach(emptyDb);
afterEach(() => {
  globalThis.fetch = realFetch;
  config.TURNSTILE_SECRET_KEY = realSecret;
});
afterAll(closeDb);

test("a visit not cleared by Turnstile may not pay; outside a visit isn't refused", async () => {
  expect(await asSpender(visitor, () => mayPay(), false)).toBe(false);
  expect(await asSpender(visitor, () => mayPay(), true)).toBe(true);
  expect(await mayPay()).toBe(true);
});

test("one visitor's paid searches stop at the day's limit", async () => {
  const day = new Date().toISOString().slice(0, 10);
  await prisma.apiUsage.create({
    data: {
      provider: paidLabel(visitor, day),
      month: new Date(`${day.slice(0, 7)}-01`),
      calls: PAID_A_DAY - 1,
    },
  });
  expect(await asSpender(visitor, () => mayPay())).toBe(true);
  await asSpender(visitor, () => notePaid());
  expect(await asSpender(visitor, () => mayPay())).toBe(false);
  // another visitor, and a signed-in account, have their own
  const other = { visitor: "0123456789abcdef", userAgent: null };
  expect(await asSpender(other, () => mayPay())).toBe(true);
  expect(await asSpender({ userId: 1 }, () => mayPay())).toBe(true);
});

test("the human check says yes, no, or unsure when Cloudflare can't be reached", async () => {
  config.TURNSTILE_SECRET_KEY = "secret";
  const answer = (success: boolean) =>
    (async () => new Response(JSON.stringify({ success }))) as typeof fetch;
  globalThis.fetch = answer(true);
  expect(await humanCheck("token")).toBe("yes");
  globalThis.fetch = answer(false);
  expect(await humanCheck("token")).toBe("no");
  globalThis.fetch = (async () => {
    throw new Error("blocked");
  }) as typeof fetch;
  expect(await humanCheck("token")).toBe("unsure");
  expect(await humanCheck(undefined)).toBe("no");
});
