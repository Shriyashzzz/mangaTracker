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

test("the shelf needs a sign in", async () => {
  expect((await request(app).get("/api/manga")).status).toBe(401);
  expect((await request(app).get("/api/auth/me")).status).toBe(401);
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
});

test("the API's robots.txt only allows the sitemap and covers", async () => {
  const res = await request(app).get("/robots.txt");
  expect(res.text).toContain("Allow: /sitemap.xml");
  expect(res.text).toContain("Disallow: /");
});
