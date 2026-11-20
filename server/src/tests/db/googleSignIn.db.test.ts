// Signing in with Google, with a real database. Google itself is stood in
// for: a token "token-for-<who>-..." is a good one for that Google account,
// whose name is in NAMES (none for the rest); anything else is turned away,
// as a forged or expired one would be
import request from "supertest";
import { app } from "../../app.js";
import { googleSignIn } from "../../auth/googleSignIn.js";
import userQueries from "../../models/userQueries.js";
import transporter from "../../config/smtp.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const NAMES: Record<string, string> = {
  sarah: "Sarah Lee",
  sarah2: "Sarah Lee",
  zoe: "Zoë Brontë",
  sato: "佐藤",
  admin: "Admin",
};
// the emails Google says are verified; the rest have none it vouches for
const EMAILS: Record<string, string> = {
  sarah: "sarah.lee@example.com",
  dana: "dana@example.com",
};
googleSignIn.accountOf = async (token: string) => {
  const who = token.match(/^token-for-(\w+)-/)?.[1];
  return who
    ? { googleId: who, name: NAMES[who] ?? null, email: EMAILS[who] ?? null }
    : null;
};
// nothing is really mailed: what would have gone out is kept
const sent: { to: string; subject: string }[] = [];
(transporter as { sendMail: unknown }).sendMail = async (mail: {
  to: string;
  subject: string;
}) => {
  sent.push(mail);
};
beforeEach(() => {
  sent.length = 0;
});
const tokenFor = (who: string) => `token-for-${who}-${"x".repeat(30)}`;

beforeEach(emptyDb);
afterAll(closeDb);

// each sign-in from its own address: making accounts is limited to a few an
// hour from one place (authRouter signUpAccounts), and these make many
let address = 0;
const withGoogle = (agent: ReturnType<typeof request.agent>, who: string) =>
  agent
    .post("/api/auth/google")
    .set("X-Forwarded-For", `10.1.0.${++address}`)
    .send({ credential: tokenFor(who) });

test("a new Google account gets a shelf: no password, no email, a username made up", async () => {
  const agent = request.agent(app);
  const res = await withGoogle(agent, "alice");
  expect(res.status).toBe(201);
  const account = await agent.get("/api/account");
  expect(account.status).toBe(200);
  expect(account.body).toMatchObject({
    google: true,
    hasPassword: false,
    recoveryEmail: null,
    weeklyEmail: false,
  });
  // no name from Google: a username made up
  expect(account.body.username).toMatch(/^reader\d{6}$/);
  // neither the hash nor the Google ID is ever sent
  expect(account.body).not.toHaveProperty("password");
  expect(account.body).not.toHaveProperty("googleId");
});

test("the same Google account comes back to the same shelf", async () => {
  await withGoogle(request.agent(app), "alice");
  const again = request.agent(app);
  const res = await withGoogle(again, "alice");
  expect(res.status).toBe(200);
  expect(await prisma.user.count()).toBe(1);
});

test("a token Google didn't confirm lets nobody in and makes nothing", async () => {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/google")
    .send({ credential: "forged-" + "x".repeat(30) });
  expect(res.status).toBe(401);
  expect(await prisma.user.count()).toBe(0);
  expect((await agent.get("/api/account")).status).toBe(401);
});

test("an account with no password can't be signed in to with one", async () => {
  const agent = request.agent(app);
  await withGoogle(agent, "alice");
  const { username } = (await agent.get("/api/account")).body;
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: "anything at all" });
  expect(res.status).toBe(401);
});

test("an existing shelf links Google, and Google then signs in to it", async () => {
  const id = (await userQueries.addUser("bobby", "a long password"))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "bobby", password: "a long password" });
  const linked = await agent
    .post("/api/account/google")
    .send({ credential: tokenFor("bobby") });
  expect(linked.status).toBe(200);
  expect(linked.body).toMatchObject({ google: true, hasPassword: true });

  const viaGoogle = request.agent(app);
  expect((await withGoogle(viaGoogle, "bobby")).status).toBe(200);
  expect((await viaGoogle.get("/api/account")).body.username).toBe("bobby");
  expect(await prisma.user.count()).toBe(1);
  expect(id).toBeGreaterThan(0);
});

test("a Google account already on another shelf can't be linked to a second", async () => {
  await withGoogle(request.agent(app), "alice");
  await userQueries.addUser("bobby", "a long password");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "bobby", password: "a long password" });
  const res = await agent
    .post("/api/account/google")
    .send({ credential: tokenFor("alice") });
  expect(res.status).toBe(409);
});

test("a Google shelf sets a first password, and its username signs in after", async () => {
  const agent = request.agent(app);
  await withGoogle(agent, "alice");
  const set = await agent
    .post("/api/account/password")
    .send({ password: "my new password" });
  expect(set.status).toBe(200);
  expect(set.body).toMatchObject({ hasPassword: true, google: true });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: set.body.username, password: "my new password" });
  expect(res.status).toBe(200);
  // only a first one: changing it is the reset email
  const again = await agent
    .post("/api/account/password")
    .send({ password: "another password" });
  expect(again.status).toBe(409);
  // too short is turned away as at sign-up
  const agent2 = request.agent(app);
  await withGoogle(agent2, "carol");
  const short = await agent2
    .post("/api/account/password")
    .send({ password: "short" });
  expect(short.status).toBe(400);
});

test("a Google shelf is deleted by typing its username, never a wrong one", async () => {
  const agent = request.agent(app);
  await withGoogle(agent, "alice");
  const { username } = (await agent.get("/api/account")).body;
  const wrong = await agent
    .delete("/api/account")
    .send({ username: "someoneelse" });
  expect(wrong.status).toBe(401);
  expect(wrong.body.error[0].msg).toBe("That isn't your username.");
  const right = await agent
    .delete("/api/account")
    .send({ username: username.toUpperCase() });
  expect(right.status).toBe(204);
  expect(await prisma.user.count()).toBe(0);
});

test("a shelf with a password still needs the password to be deleted", async () => {
  await userQueries.addUser("bobby", "a long password");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "bobby", password: "a long password" });
  const byName = await agent.delete("/api/account").send({ username: "bobby" });
  expect(byName.status).toBe(401);
  expect(byName.body.error[0].msg).toBe("That password isn't right.");
  expect(await prisma.user.count()).toBe(1);
});

test("making Google accounts from one place is limited like signing up", async () => {
  const made: number[] = [];
  for (let i = 0; i < 6; i++) {
    const res = await request(app)
      .post("/api/auth/google")
      .set("X-Forwarded-For", "10.9.9.9")
      .send({ credential: tokenFor(`many${i}`) });
    made.push(res.status);
  }
  expect(made).toEqual([201, 201, 201, 201, 201, 429]);
});

test("a Google name becomes the username, with a number when it's taken", async () => {
  const usernameAfter = async (who: string) => {
    const agent = request.agent(app);
    await withGoogle(agent, who);
    return (await agent.get("/api/account")).body.username as string;
  };
  expect(await usernameAfter("sarah")).toBe("sarahlee");
  // another Sarah Lee's Google account
  expect(await usernameAfter("sarah2")).toBe("sarahlee2");
  // accents dropped
  expect(await usernameAfter("zoe")).toBe("zoebronte");
  // nothing usable, or a name kept for the site: made up
  expect(await usernameAfter("sato")).toMatch(/^reader\d{6}$/);
  expect(await usernameAfter("admin")).toMatch(/^reader\d{6}$/);
});

test("a username taken in other capitals counts as taken", async () => {
  await userQueries.addUser("SarahLee", "a long password");
  const agent = request.agent(app);
  await withGoogle(agent, "sarah");
  expect((await agent.get("/api/account")).body.username).toBe("sarahlee2");
});

test("Google's verified email is saved, confirmed, with the weekly email off and nothing mailed", async () => {
  const agent = request.agent(app);
  await withGoogle(agent, "sarah");
  const account = (await agent.get("/api/account")).body;
  expect(account).toMatchObject({
    recoveryEmail: "sarah.lee@example.com",
    emailConfirmed: true,
    weeklyEmail: false,
  });
  expect(sent).toEqual([]);
});

test("an email Google doesn't vouch for isn't saved", async () => {
  const agent = request.agent(app);
  await withGoogle(agent, "zoe");
  expect((await agent.get("/api/account")).body.recoveryEmail).toBeNull();
});

test("an email another account has stays with that account", async () => {
  const id = (await userQueries.addUser("danaold", "a long password"))!;
  await userQueries.updateAccount(id, { recoveryEmail: "dana@example.com" });
  sent.length = 0;
  const agent = request.agent(app);
  expect((await withGoogle(agent, "dana")).status).toBe(201);
  expect((await agent.get("/api/account")).body.recoveryEmail).toBeNull();
  const other = await prisma.user.findUnique({ where: { id } });
  expect(other?.recoveryEmail).toBe("dana@example.com");
});

test("Yes on the site starts the weekly email at once, with no link to press", async () => {
  const agent = request.agent(app);
  await withGoogle(agent, "sarah");
  const yes = await agent.post("/api/account/weekly-email").send({ on: true });
  expect(yes.status).toBe(200);
  expect(yes.body).toMatchObject({ weeklyEmail: true, emailConfirmed: true });
  expect(sent).toEqual([]);
});
