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
appleSignatures.notification = async (s: string) =>
  s.startsWith("note-")
    ? ({ data: { signedTransactionInfo: s.slice(5) } } as never)
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
