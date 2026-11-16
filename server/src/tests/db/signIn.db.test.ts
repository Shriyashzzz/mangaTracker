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
