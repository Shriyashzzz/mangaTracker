// The reader's own address behind Cloudflare (util/clientIp.ts), and the
// rate limiter keeping each reader to their own count
import express from "express";
import request from "supertest";
import { rateLimit } from "../middlewares/rateLimit.js";
import { clientIp } from "../util/clientIp.js";

const echo = express();
echo.get("/ip", (req, res) => {
  res.json({ ip: clientIp(req) });
});

test("Cloudflare's CF-Connecting-IP names the reader", async () => {
  const res = await request(echo)
    .get("/ip")
    .set("CF-Connecting-IP", "203.0.113.7");
  expect(res.body.ip).toBe("203.0.113.7");
});

test("an IPv6 reader is named too", async () => {
  const res = await request(echo)
    .get("/ip")
    .set("CF-Connecting-IP", "2001:db8::1");
  expect(res.body.ip).toBe("2001:db8::1");
});

test("without it, or with junk in it, the connection's own address", async () => {
  const plain = await request(echo).get("/ip");
  expect(plain.body.ip).toMatch(/127\.0\.0\.1|::1/);
  const junk = await request(echo)
    .get("/ip")
    .set("CF-Connecting-IP", "<script>alert(1)</script>");
  expect(junk.body.ip).toMatch(/127\.0\.0\.1|::1/);
});

test("two readers behind one Cloudflare edge each get their own limit", async () => {
  const app = express();
  app.get("/x", rateLimit({ max: 2, windowMs: 60_000 }), (_req, res) => {
    res.json({ ok: true });
  });
  const as = (who: string) =>
    request(app).get("/x").set("CF-Connecting-IP", who);
  expect((await as("198.51.100.1")).status).toBe(200);
  expect((await as("198.51.100.1")).status).toBe(200);
  // the first is now limited...
  expect((await as("198.51.100.1")).status).toBe(429);
  // ...and the second, arriving through the same edge, isn't
  expect((await as("198.51.100.2")).status).toBe(200);
});
