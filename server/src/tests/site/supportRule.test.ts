// When Kenji may ask for a coffee (client/src/lib/supportRule.ts): never a
// first-time visitor
import {
  canShow,
  isFirstVisit,
  withFirstVisit,
} from "../../../../client/src/lib/supportRule.js";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

test("he never asks on someone's first day here", () => {
  // just arrived, and clicked through to a store
  const today = withFirstVisit({}, now, false);
  expect(today.firstSeenAt).toBe(now);
  expect(isFirstVisit(today, now)).toBe(true);
  expect(canShow(today, now)).toBe(false);
  // still the same visit, hours on
  expect(canShow(today, now + 5 * 60 * 60 * 1000)).toBe(false);
  // nothing on record at all is a first visit too
  expect(canShow({}, now)).toBe(false);
});

test("back on a later day, he may", () => {
  const first = withFirstVisit({}, now, false);
  expect(canShow(first, now + 2 * DAY)).toBe(true);
});

test("a regular isn't made a stranger the day the rule arrives", () => {
  // signed in before, or already asked once months ago: here before
  expect(withFirstVisit({}, now, true).firstSeenAt).toBe(0);
  const asked = { shows: 1, lastShownAt: now - 200 * DAY };
  const known = withFirstVisit(asked, now, false);
  expect(known.firstSeenAt).toBe(0);
  expect(canShow(known, now)).toBe(true);
  // a store click waiting from before the rule proves nothing: it can be
  // from a first visit, so the clock starts now
  const clicked = withFirstVisit({ pending: true }, now, false);
  expect(clicked.firstSeenAt).toBe(now);
  expect(canShow(clicked, now)).toBe(false);
  // a first visit already on record is left as it is
  expect(withFirstVisit({ firstSeenAt: 5 }, now, false).firstSeenAt).toBe(5);
});

test("the old limits still hold: twice, months apart, never once closed", () => {
  const regular = { firstSeenAt: 0 };
  expect(canShow({ ...regular, done: true }, now)).toBe(false);
  expect(canShow({ ...regular, shows: 2 }, now)).toBe(false);
  const lately = { ...regular, shows: 1, lastShownAt: now - 10 * DAY };
  expect(canShow(lately, now)).toBe(false);
  const longAgo = { ...regular, shows: 1, lastShownAt: now - 100 * DAY };
  expect(canShow(longAgo, now)).toBe(true);
});
