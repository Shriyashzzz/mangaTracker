// Accounts, through the real routes and a real database: signing up and in,
// a taken name, a wrong password, signing out, and deleting an account, which
// takes its shelf and its sign-ins with it.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

const PASSWORD = "a good password";

// a browser that keeps its cookie between requests, signed up through the
// route. Sign-ups are limited to 5 an hour, so only the sign-up tests use it
const signedUp = async (username = "reader") => {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/signup")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(201);
  return agent;
};

test("signing up signs you in", async () => {
  const agent = await signedUp();
  expect((await agent.get("/api/auth/me")).status).toBe(200);
  const user = await prisma.user.findUnique({ where: { username: "reader" } });
  // the password is stored hashed, never as typed
  expect(user?.password).not.toContain(PASSWORD);
});

test("a taken username is turned away", async () => {
  await signedUp("taken");
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ username: "taken", password: PASSWORD });
  expect(res.status).toBe(409);
  expect(await prisma.user.count()).toBe(1);
});

// made directly, then signed in through the route (10 every 5 minutes)
const signedIn = async (username = "reader") => {
  await userQueries.addUser(username, PASSWORD);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: PASSWORD })
    .expect(200);
  return agent;
};

test("signing in needs the right password, and signing out ends it", async () => {
  await userQueries.addUser("reader", PASSWORD);
  const wrong = await request(app)
    .post("/api/auth/login")
    .send({ username: "reader", password: "not it" });
  expect(wrong.status).toBe(401);

  const agent = request.agent(app);
  const right = await agent
    .post("/api/auth/login")
    .send({ username: "reader", password: PASSWORD });
  expect(right.status).toBe(200);
  expect((await agent.get("/api/auth/me")).status).toBe(200);

  await agent.post("/api/auth/logout");
  expect((await agent.get("/api/auth/me")).status).toBe(401);
});

test("deleting an account needs its password, and takes everything with it", async () => {
  const agent = await signedIn();
  await agent
    .post("/api/manga")
    .send({ name: "Spice and Wolf", status: false, lightNovel: true })
    .expect(201);

  expect(
    (await agent.delete("/api/account").send({ password: "not it" })).status,
  ).toBe(401);
  expect(await prisma.user.count()).toBe(1);

  expect(
    (await agent.delete("/api/account").send({ password: PASSWORD })).status,
  ).toBe(204);
  expect(await prisma.user.count()).toBe(0);
  expect(await prisma.manga.count()).toBe(0);
  // signed out everywhere, and the name can't sign in again
  expect((await agent.get("/api/auth/me")).status).toBe(401);
  const again = await request(app)
    .post("/api/auth/login")
    .send({ username: "reader", password: PASSWORD });
  // no such account any more
  expect(again.status).toBe(404);
});
