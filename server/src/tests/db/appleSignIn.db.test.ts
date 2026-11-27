// Signing in with Apple through the real routes and a real database, with a
// stand-in for Apple's token check (src/auth/appleSignIn.ts)
import request from "supertest";
import { app } from "../../app.js";
import { appleSignIn } from "../../auth/appleSignIn.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const EMAILS: Record<string, string> = {
  mia: "mia@example.com",
  relay: "abc123@privaterelay.appleid.com",
};
// a website token carries the nonce it was asked with: "...-nonce-<n>"
appleSignIn.accountOf = async (token: string, webNonce?: string) => {
  const who = token.match(/^apple-token-for-(\w+)-/)?.[1];
  if (webNonce !== undefined && !token.endsWith(`-nonce-${webNonce}`))
    return null;
  return who ? { appleId: `apple.${who}`, email: EMAILS[who] ?? null } : null;
};
const tokenFor = (who: string) => `apple-token-for-${who}-${"x".repeat(30)}`;

beforeEach(emptyDb);
afterAll(closeDb);

test("a first Apple sign-in makes an account named by first name, signed in", async () => {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/apple")
    .send({ identityToken: tokenFor("mia"), name: "Mia" })
    .expect(201);
  const account = (await agent.get("/api/account").expect(200)).body;
  // "Mia" is too short for a username alone: a made-up one
  expect(account.username).toMatch(/^reader\d{6}$/);
  expect(account).toMatchObject({
    recoveryEmail: "mia@example.com",
    emailConfirmed: true,
    weeklyEmail: true,
  });
  const user = await prisma.user.findFirst({ where: { appleId: "apple.mia" } });
  expect(user?.password).toBeNull();
});

test("the next sign-in finds the same account", async () => {
  await request(app)
    .post("/api/auth/apple")
    .send({ identityToken: tokenFor("relay"), name: "Jordan" })
    .expect(201);
  // Apple sends no name after the first time
  await request(app)
    .post("/api/auth/apple")
    .send({ identityToken: tokenFor("relay") })
    .expect(200);
  expect(await prisma.user.count({ where: { appleId: "apple.relay" } })).toBe(
    1,
  );
  const user = await prisma.user.findFirst({
    where: { appleId: "apple.relay" },
  });
  expect(user).toMatchObject({
    username: "jordan",
    recoveryEmail: "abc123@privaterelay.appleid.com",
  });
});

test("no name from Apple: a made-up username", async () => {
  await request(app)
    .post("/api/auth/apple")
    .send({ identityToken: tokenFor("quiet") })
    .expect(201);
  const user = await prisma.user.findFirst({
    where: { appleId: "apple.quiet" },
  });
  expect(user?.username).toMatch(/^reader\d{6}$/);
  expect(user?.recoveryEmail).toBeNull();
});

test("a token Apple doesn't confirm lets nobody in", async () => {
  await request(app)
    .post("/api/auth/apple")
    .send({ identityToken: "not-a-real-token-from-apple-at-all" })
    .expect(401);
  expect(await prisma.user.count()).toBe(0);
});

// the website's: Apple's page posts a form back to /apple/return
const webToken = (who: string, nonce: string) =>
  `${tokenFor(who)}-nonce-${nonce}`;

test("the website: back from Apple, signed in and on to where they were going", async () => {
  const agent = request.agent(app);
  const answer = await agent
    .post("/api/auth/apple/return")
    .set("Cookie", "apple_nonce=n123")
    .type("form")
    .send({
      id_token: webToken("mia", "n123"),
      state: "/prices/series/vagabond",
      user: JSON.stringify({ name: { firstName: "Miabelle" } }),
    })
    .expect(303);
  // to the sign-in page, which finishes signing in there and moves on
  expect(answer.headers.location).toBe(
    "/signin?apple=done&next=%2Fprices%2Fseries%2Fvagabond",
  );
  const account = (await agent.get("/api/account").expect(200)).body;
  expect(account.username).toBe("miabelle");
});

test("the website: a token asked for with another nonce lets nobody in", async () => {
  const answer = await request(app)
    .post("/api/auth/apple/return")
    .set("Cookie", "apple_nonce=mine")
    .type("form")
    .send({ id_token: webToken("mia", "theirs"), state: "/shelf" })
    .expect(303);
  expect(answer.headers.location).toBe("/signin?apple=failed");
  // and none at all, without the cookie
  await request(app)
    .post("/api/auth/apple/return")
    .type("form")
    .send({ id_token: webToken("mia", "theirs") })
    .expect(303);
  expect(await prisma.user.count()).toBe(0);
});

test("the website: only a path on this site is followed after", async () => {
  for (const state of [
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
  ]) {
    const answer = await request(app)
      .post("/api/auth/apple/return")
      .set("Cookie", "apple_nonce=n1")
      .type("form")
      .send({ id_token: webToken("relay", "n1"), state })
      .expect(303);
    expect(answer.headers.location).toBe("/signin?apple=done&next=%2Fshelf");
  }
});

test("the website: Cancel on Apple's page goes back to sign in", async () => {
  const answer = await request(app)
    .post("/api/auth/apple/return")
    .type("form")
    .send({ error: "user_cancelled_authorize" })
    .expect(303);
  expect(answer.headers.location).toBe("/signin");
});

test("the website: one place makes at most 5 accounts an hour, then back to sign in", async () => {
  const made: string[] = [];
  for (let n = 0; n < 6; n++) {
    const answer = await request(app)
      .post("/api/auth/apple/return")
      .set("Cookie", `apple_nonce=cap${n}`)
      .type("form")
      .send({ id_token: webToken(`cap${n}`, `cap${n}`) });
    made.push(answer.headers.location as string);
  }
  // (the cap is kept in memory for the hour, so accounts the tests above
  // made here count too): a few made, then every one after turned back
  const done = made.filter((to) => to.includes("apple=done")).length;
  expect(done).toBeGreaterThan(0);
  expect(done).toBeLessThan(5);
  expect(made.slice(done).every((to) => to === "/signin?apple=failed")).toBe(
    true,
  );
  expect(await prisma.user.count()).toBe(done);
});

test("the website: a failure on our side still goes back to sign in", async () => {
  const real = appleSignIn.accountOf;
  appleSignIn.accountOf = async () => {
    throw new Error("the database is down");
  };
  try {
    const answer = await request(app)
      .post("/api/auth/apple/return")
      .set("Cookie", "apple_nonce=n9")
      .type("form")
      .send({ id_token: webToken("mia", "n9") })
      .expect(303);
    expect(answer.headers.location).toBe("/signin?apple=failed");
  } finally {
    appleSignIn.accountOf = real;
  }
});
