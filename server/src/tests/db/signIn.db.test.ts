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
