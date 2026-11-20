// When Kenji asks about the weekly email (client/src/lib/weeklyAsk.ts): a
// Google reader with a confirmed email and the weekly email off, once a device
import {
  weeklyAskDue,
  weeklyAskFits,
} from "../../../../client/src/lib/weeklyAsk.js";
import type { Account } from "../../../../client/src/lib/account.js";

const account = (over: Partial<Account> = {}) =>
  ({
    google: true,
    recoveryEmail: "sarah.lee@example.com",
    emailConfirmed: true,
    weeklyEmail: false,
    ...over,
  }) as Account;

test("a Google reader with a confirmed email and the weekly email off is asked", () => {
  expect(weeklyAskDue(account(), false)).toBe(true);
});

test("asked once a device", () => {
  expect(weeklyAskDue(account(), true)).toBe(false);
});

test("nobody else is asked", () => {
  // signed up with a username: their own email, their own switch
  expect(weeklyAskFits(account({ google: false }))).toBe(false);
  expect(weeklyAskFits(account({ recoveryEmail: null }))).toBe(false);
  expect(weeklyAskFits(account({ emailConfirmed: false }))).toBe(false);
  // already on
  expect(weeklyAskFits(account({ weeklyEmail: true }))).toBe(false);
  // not loaded yet
  expect(weeklyAskFits(null)).toBe(false);
});
