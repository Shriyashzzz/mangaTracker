// Routes that answer without touching the database
import request from "supertest";
import { app } from "../app.js";
import { pool } from "../config/prisma.js";

afterAll(() => pool.end());

test("health check", async () => {
  const res = await request(app).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

test("the shelf needs a sign in, answered as a JSON error", async () => {
  for (const path of ["/api/manga", "/api/manga/1", "/api/auth/me", "/api/prefs"]) {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
    expect(res.type).toBe("application/json");
    expect(res.body.error[0].msg).toEqual(expect.any(String));
  }
});

test("each invalid field gets one message, its first broken rule", async () => {
  const res = await request(app).post("/api/auth/login").send({});
  expect(res.status).toBe(400);
  expect(res.body.error.map((e: { path: string; msg: string }) => [e.path, e.msg])).toEqual([
    ["username", "I need your name to let you in, come on you know that!"],
    ["password", "Alright, don't forget your secret code. Spill the beans now!"],
  ]);
});

test("a bad ISBN is a 400 with a message", async () => {
  const res = await request(app).get("/api/prices/12345");
  expect(res.status).toBe(400);
  expect(res.body.error[0].msg).toBe("That isn't a valid ISBN");
});

test("sign up validates before touching the database", async () => {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ username: "ab", password: "1" });
  expect(res.status).toBe(400);
  expect(res.body.error).toHaveLength(2);
});

test("unknown routes are JSON 404s", async () => {
  const res = await request(app).get("/nope");
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: [{ msg: "Not found" }] });
});

test("the API's robots.txt only allows the sitemap and covers", async () => {
  const res = await request(app).get("/robots.txt");
  expect(res.text).toContain("Allow: /sitemap.xml");
  expect(res.text).toContain("Disallow: /");
});
