// Signing in with a real database: a wrong username and a wrong password get
// the same answer, so the sign-in can't be used to find out which usernames
// exist. In its own file: sign-ins are limited to 10 in 5 minutes.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

const signIn = (username: string, password: string) =>
  request(app).post("/api/auth/login").send({ username, password });

test("a wrong username and a wrong password answer the same", async () => {
  await userQueries.addUser("realreader", "a good password");

  const noSuchName = await signIn("nosuchreader", "a good password");
  const wrongPassword = await signIn("realreader", "not the password");

  expect(noSuchName.status).toBe(401);
  expect(wrongPassword.status).toBe(401);
  expect(noSuchName.body).toEqual(wrongPassword.body);

  // and the right ones still get in
  await signIn("realreader", "a good password").expect(200);
});

const signUp = (body: object) =>
  request(app).post("/api/auth/signup").send(body);

test("sign-up refuses a password of spaces and a username that isn't text", async () => {
  const spaces = await signUp({ username: "spacey", password: "        " });
  expect(spaces.status).toBe(400);
  expect(spaces.body.error[0].msg).toBe("A password needs more than spaces.");
  const list = await signUp({ username: ["x"], password: "a good password" });
  expect(list.status).toBe(400);
});

test("an error never sends back what was typed", async () => {
  const res = await signUp({ username: "ab", password: "secret" });
  expect(res.status).toBe(400);
  expect(JSON.stringify(res.body)).not.toContain("secret");
  for (const error of res.body.error) expect(error).not.toHaveProperty("value");
});

test("sign-up keeps the site's names, and says one thing a box", async () => {
  const admin = await signUp({
    username: "Admin",
    password: "a good password",
  });
  expect(admin.status).toBe(400);
  expect(admin.body.error[0].msg).toBe(
    "That name is kept for the site. Pick another.",
  );
  // a short password is told the sign-up rule only, never sign-in's old 5
  for (const password of ["abc", "abcdef"]) {
    const short = await signUp({ username: "shorty", password });
    expect(short.body.error.map((e: { msg: string }) => e.msg)).toEqual([
      "Passwords need at least 8 characters.",
    ]);
  }
  // "a!" breaks two username rules, and hears about one
  const both = await signUp({ username: "a!", password: "x" });
  const about = both.body.error.filter(
    (e: { path: string }) => e.path === "username",
  );
  expect(about).toHaveLength(1);
});

test("an id too big for the database is not found, not a crash", async () => {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/signup")
    .send({ username: "bigid", password: "a good password" })
    .expect(201);
  await agent.get("/api/manga/999999999999").expect(404);
  await agent
    .patch("/api/manga/999999999999/bookmark")
    .send({ bookmark: 3 })
    .expect(404);
});
