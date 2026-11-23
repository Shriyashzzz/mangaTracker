// Collector bought through the App Store, through the real routes and a
// real database, with a stand-in for Apple's signature check only
// (src/plan/applePurchases.ts)
import request from "supertest";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import { app } from "../../app.js";
import { appleSignatures } from "../../plan/applePurchases.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const PASSWORD = "a good password";
const day = 86_400_000;

// "signed" transactions the stand-in reads as JSON
const signed = (t: Partial<JWSTransactionDecodedPayload>) =>
  `signed-${Buffer.from(JSON.stringify(t)).toString("base64url")}`;
const yearly = (over: Partial<JWSTransactionDecodedPayload> = {}) => ({
  productId: "collector.yearly",
  bundleId: "xyz.mangatracker.app",
  originalTransactionId: "2000000111",
  expiresDate: Date.now() + 365 * day,
  ...over,
});
appleSignatures.transaction = async (s: string) =>
  s.startsWith("signed-")
    ? (JSON.parse(
        Buffer.from(s.slice(7), "base64url").toString(),
      ) as JWSTransactionDecodedPayload)
    : null;
// "note-<transaction>", or "note-<transaction>~renew-0" when Apple says
// it won't renew (cancelled) and "~renew-1" when it will
appleSignatures.notification = async (s: string) => {
  if (!s.startsWith("note-")) return null;
  const [transaction, renewal] = s.slice(5).split("~");
  return {
    data: { signedTransactionInfo: transaction, signedRenewalInfo: renewal },
  } as never;
};
appleSignatures.renewal = async (s: string) =>
  s.startsWith("renew-")
    ? ({ autoRenewStatus: Number(s.slice(6)) } as never)
    : null;

async function reader(name = "reader", plan = "free") {
  const userId = (await userQueries.addUser(name, PASSWORD))!;
  await prisma.user.update({ where: { id: userId }, data: { plan } });
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: name, password: PASSWORD })
    .expect(200);
  return { userId, agent };
}

beforeEach(emptyDb);
afterAll(closeDb);

test("a Collector purchase Apple vouches for makes the account a Collector until it runs out", async () => {
  const { userId, agent } = await reader();
  const res = await agent
    .post("/api/account/plan/apple")
    .send({ signedTransaction: signed(yearly()) })
    .expect(200);
  expect(res.body).toMatchObject({ plan: "collector" });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user).toMatchObject({
    plan: "collector",
    appleSubscription: "2000000111",
  });
});

test("something that isn't Collector, or isn't Apple's, changes nothing", async () => {
  const { userId, agent } = await reader();
  for (const bad of [
    signed(yearly({ productId: "coins.100" })),
    signed(yearly({ bundleId: "com.someone.else" })),
    "not-signed-by-apple-at-all",
  ])
    await agent
      .post("/api/account/plan/apple")
      .send({ signedTransaction: bad })
      .expect(400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user).toMatchObject({ plan: "free", appleSubscription: null });
});

test("Apple's renewal moves the end on; a refund ends it now", async () => {
  const { userId, agent } = await reader();
  await agent
    .post("/api/account/plan/apple")
    .send({
      signedTransaction: signed(yearly({ expiresDate: Date.now() + day })),
    })
    .expect(200);
  const later = Date.now() + 400 * day;
  await request(app)
    .post("/api/apple/notifications")
    .send({ signedPayload: `note-${signed(yearly({ expiresDate: later }))}` })
    .expect(200);
  let user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user?.planUntil?.getTime()).toBe(later);
  await request(app)
    .post("/api/apple/notifications")
    .send({
      signedPayload: `note-${signed(yearly({ revocationDate: Date.now() - 1000 }))}`,
    })
    .expect(200);
  user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user!.planUntil!.getTime()).toBeLessThan(Date.now());
  const plan = (await agent.get("/api/account/plan").expect(200)).body;
  expect(plan.plan).toBe("free");
});

test("restored on another account, the subscription moves with the Apple ID", async () => {
  const first = await reader("first");
  await first.agent
    .post("/api/account/plan/apple")
    .send({ signedTransaction: signed(yearly()) })
    .expect(200);
  const second = await reader("second");
  await second.agent
    .post("/api/account/plan/apple")
    .send({ signedTransaction: signed(yearly()) })
    .expect(200);
  const [a, b] = await Promise.all(
    [first.userId, second.userId].map((id) =>
      prisma.user.findUnique({ where: { id } }),
    ),
  );
  expect(a).toMatchObject({ plan: "free", appleSubscription: null });
  expect(b).toMatchObject({
    plan: "collector",
    appleSubscription: "2000000111",
  });
});

test("an early member who subscribes stays an early member", async () => {
  const { userId, agent } = await reader("early", "early");
  await agent
    .post("/api/account/plan/apple")
    .send({ signedTransaction: signed(yearly()) })
    .expect(200);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user?.plan).toBe("early");
});

test("a notification nobody signed is answered and ignored", async () => {
  await request(app)
    .post("/api/apple/notifications")
    .send({ signedPayload: "x".repeat(40) })
    .expect(200);
});

test("the member card: since when, yearly, renewing, then ended once cancelled", async () => {
  const { userId, agent } = await reader();
  await agent
    .post("/api/account/plan/apple")
    .send({ signedTransaction: signed(yearly()) })
    .expect(200);
  let member = (await agent.get("/api/account/plan").expect(200)).body.member;
  expect(member).toMatchObject({
    sinceKind: "collector",
    period: "year",
    renews: true,
    caughtOnSale: 0,
  });
  const since = member.since;
  // cancelled in Apple's settings: still a Collector until it runs out
  await request(app)
    .post("/api/apple/notifications")
    .send({ signedPayload: `note-${signed(yearly())}~renew-0` })
    .expect(200);
  member = (await agent.get("/api/account/plan").expect(200)).body.member;
  expect(member).toMatchObject({ renews: false, since });
  // restored later: a cancelled one stays cancelled, and since doesn't move
  await agent
    .post("/api/account/plan/apple")
    .send({ signedTransaction: signed(yearly()) })
    .expect(200);
  member = (await agent.get("/api/account/plan").expect(200)).body.member;
  expect(member).toMatchObject({ renews: false, since });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user?.collectorSince?.toISOString()).toBe(since);
});

test("the member card counts each book caught on sale once, by email or push", async () => {
  const { userId, agent } = await reader("early", "early");
  await prisma.digestItem.createMany({
    data: [
      "drop:9781974700001",
      "push:drop:9781974700001",
      "push:drop:9781974700002",
      "arrived:9781974700003",
      "push:target:9781974700004:900",
    ].map((item) => ({ userId, item })),
  });
  const member = (await agent.get("/api/account/plan").expect(200)).body.member;
  expect(member).toMatchObject({
    sinceKind: "account",
    period: null,
    until: null,
    renews: null,
    caughtOnSale: 2,
  });
});

test("a free account has no member card", async () => {
  const { agent } = await reader();
  const plan = (await agent.get("/api/account/plan").expect(200)).body;
  expect(plan.member).toBeNull();
});
