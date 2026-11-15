// the per-visitor limiter (middlewares/rateLimit.ts), with `counts`: only
// requests answered a certain way count, but every one is counted while it's
// being answered, so a burst sent at once can't slip past
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { rateLimit } from "../../middlewares/rateLimit.js";

// a request from one place, and its response, which finishes when told
function fakeRequest() {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 0,
    set: () => res,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json: () => res,
  });
  return { req: { ip: "1.2.3.4" } as Request, res };
}
const through = (
  limit: ReturnType<typeof rateLimit>,
  { req, res }: ReturnType<typeof fakeRequest>,
) => {
  let passed = false;
  limit(req, res as unknown as Response, () => (passed = true));
  return passed;
};

test("failed tries don't count, made accounts do", () => {
  const limit = rateLimit({
    max: 2,
    windowMs: 60_000,
    counts: (s) => s === 201,
  });
  for (let i = 0; i < 5; i++) {
    const call = fakeRequest();
    expect(through(limit, call)).toBe(true);
    call.res.statusCode = 400;
    call.res.emit("finish");
  }
  for (const status of [201, 201]) {
    const call = fakeRequest();
    expect(through(limit, call)).toBe(true);
    call.res.statusCode = status;
    call.res.emit("finish");
  }
  expect(through(limit, fakeRequest())).toBe(false);
});

test("a burst sent at once can't all get past", () => {
  const limit = rateLimit({
    max: 2,
    windowMs: 60_000,
    counts: (s) => s === 201,
  });
  // three arrive before any is answered
  const results = [fakeRequest(), fakeRequest(), fakeRequest()].map((call) =>
    through(limit, call),
  );
  expect(results).toEqual([true, true, false]);
});
