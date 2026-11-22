// Alerts on readers' phones with a real database (src/push/): switching a
// device on and off, and sending, with a fake push service in place of the
// real one
import request from "supertest";
import { app } from "../../app.js";
import config from "../../config/config.js";
import { forgetLookedForAlerts, sendDueAlerts } from "../../push/pushSender.js";
import userQueries from "../../models/userQueries.js";
import { generateVAPIDKeys } from "web-push";
import { volumesKey } from "../../prices/volumesKey.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const SERIES = "Zzpush Alert Series";
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const day = (offset: number) =>
  new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-one";
const OTHER = "https://web.push.apple.com/device-two";
const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
const pair = generateVAPIDKeys();
const savedConfig = {
  VAPID_PUBLIC_KEY: config.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: config.VAPID_PRIVATE_KEY,
};

// what the fake push service was asked to deliver, and what it answers
type Sent = { endpoint: string; payload: string };
let delivered: Sent[] = [];
let answer: (endpoint: string) => number = () => 201;
const fakeSend = (async (
  subscription: { endpoint: string },
  payload?: string,
) => {
  const status = answer(subscription.endpoint);
  if (status >= 400)
    throw Object.assign(new Error("push"), { statusCode: status });
  delivered.push({ endpoint: subscription.endpoint, payload: payload ?? "" });
  return { statusCode: status, headers: {}, body: "" };
}) as never;

beforeEach(async () => {
  await emptyDb();
  delivered = [];
  answer = () => 201;
  forgetLookedForAlerts();
  // a real key pair, made for the tests
  Object.assign(config, {
    VAPID_PUBLIC_KEY: pair.publicKey,
    VAPID_PRIVATE_KEY: pair.privateKey,
  });
  await prisma.seriesVolumes.upsert({
    where: { key: volumesKey(SERIES) },
    update: {},
    create: {
      key: volumesKey(SERIES),
      volumes: [-400, -200, 0].map((offset, i) => ({
        volume: i + 1,
        isbn13: `979000000010${i}`,
        title: `${SERIES}, Vol. ${i + 1}`,
        published: day(offset),
      })),
    },
  });
});
afterAll(async () => {
  Object.assign(config, savedConfig);
  await prisma.seriesVolumes.deleteMany({ where: { key: volumesKey(SERIES) } });
  await closeDb();
});

async function reader(name = "reader") {
  const id = (await userQueries.addUser(name, "a long password"))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: name, password: "a long password" });
  await prisma.manga.create({
    data: { userId: id, name: SERIES, volumesOwned: 2 },
  });
  return { agent, id };
}
const on = (agent: ReturnType<typeof request.agent>, endpoint = ENDPOINT) =>
  agent.post("/api/push/subscribe").send({ endpoint, keys });

test("the key is given only when alerts are set up", async () => {
  expect((await request(app).get("/api/push/key")).body).toEqual({
    publicKey: pair.publicKey,
  });
  // none: not offered
  Object.assign(config, { VAPID_PUBLIC_KEY: undefined });
  expect((await request(app).get("/api/push/key")).status).toBe(404);
  // a wrong one: not offered either, and nothing is sent
  Object.assign(config, { VAPID_PUBLIC_KEY: "not-a-key" });
  expect((await request(app).get("/api/push/key")).status).toBe(404);
  expect(await sendDueAlerts(now, 50, fakeSend)).toMatchObject({ sent: 0 });
});

test("a device switched on and off, only by its reader", async () => {
  const { agent, id } = await reader();
  expect((await on(agent)).status).toBe(204);
  expect(await prisma.pushSubscription.count({ where: { userId: id } })).toBe(
    1,
  );
  // switched on again: still one
  await on(agent);
  expect(await prisma.pushSubscription.count()).toBe(1);
  // signed out: refused
  const signedOut = await request(app)
    .post("/api/push/subscribe")
    .send({ endpoint: ENDPOINT, keys });
  expect(signedOut.status).toBe(401);
  // someone else can't switch this device off
  const other = await reader("other");
  await other.agent.post("/api/push/unsubscribe").send({ endpoint: ENDPOINT });
  expect(await prisma.pushSubscription.count()).toBe(1);
  // its reader can
  await agent.post("/api/push/unsubscribe").send({ endpoint: ENDPOINT });
  expect(await prisma.pushSubscription.count()).toBe(0);
});

test("an address that isn't a push service is refused", async () => {
  const { agent } = await reader();
  for (const endpoint of [
    "http://mangatracker.railway.internal:8080/api/manga",
    "https://example.com/push",
    "https://fcm.googleapis.com.evil.example/x",
  ]) {
    const res = await on(agent, endpoint);
    expect([endpoint, res.status]).toEqual([endpoint, 400]);
  }
  expect(await prisma.pushSubscription.count()).toBe(0);
});

test("today's volume goes to every device once, and never again", async () => {
  const { agent } = await reader();
  await on(agent);
  await on(agent, OTHER);
  const first = await sendDueAlerts(now, 50, fakeSend);
  expect(first).toMatchObject({ sent: 1, gone: 0, failed: 0 });
  expect(delivered.map((d) => d.endpoint).sort()).toEqual(
    [OTHER, ENDPOINT].sort(),
  );
  expect(JSON.parse(delivered[0]!.payload)).toMatchObject({
    title: `${SERIES} Vol. 3 is out`,
    body: "Out today. Tap to see where to buy it.",
  });
  // the next run: nothing new
  forgetLookedForAlerts();
  delivered = [];
  expect(await sendDueAlerts(now, 50, fakeSend)).toMatchObject({ sent: 0 });
  expect(delivered).toEqual([]);
});

test("the weekly email still has the news an alert told", async () => {
  const { agent, id } = await reader();
  await on(agent);
  await sendDueAlerts(now, 50, fakeSend);
  const { digestFor } = await import("../../digest/digestData.js");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, prefs: true },
  });
  expect((await digestFor(user, now)).out).toHaveLength(1);
});

test("a device that's gone is let go; one that fails stays, and is tried again", async () => {
  const { agent } = await reader();
  await on(agent);
  await on(agent, OTHER);
  answer = (endpoint) => (endpoint === OTHER ? 410 : 201);
  const result = await sendDueAlerts(now, 50, fakeSend);
  expect(result).toMatchObject({ sent: 1, gone: 1 });
  expect(
    (await prisma.pushSubscription.findMany()).map((s) => s.endpoint),
  ).toEqual([ENDPOINT]);
  // every device failing: nothing counts as told, so it goes next time
  await prisma.digestItem.deleteMany();
  forgetLookedForAlerts();
  answer = () => 500;
  expect(await sendDueAlerts(now, 50, fakeSend)).toMatchObject({
    sent: 0,
    failed: 1,
  });
  expect(await prisma.digestItem.count()).toBe(0);
  expect(await prisma.pushSubscription.count()).toBe(1);
});

test("an account deleted takes its devices with it", async () => {
  const { agent, id } = await reader();
  await on(agent);
  await prisma.user.delete({ where: { id } });
  expect(await prisma.pushSubscription.count()).toBe(0);
});

// ---------- the phone app (push/expoPush.ts) ----------
const PHONE = "ExponentPushToken[abcdefghijklmnopqrstuv]";

test("the app's phone gets the alert through Expo, with no browser keys set", async () => {
  // no VAPID pair: browsers get nothing, the phone still does
  Object.assign(config, {
    VAPID_PUBLIC_KEY: undefined,
    VAPID_PRIVATE_KEY: undefined,
  });
  const { agent } = await reader();
  expect(
    (await agent.post("/api/push/device").send({ token: PHONE })).status,
  ).toBe(204);
  const told: { token: string; title: string; url: string }[] = [];
  const result = await sendDueAlerts(
    now,
    50,
    fakeSend,
    async (token, alert) => {
      told.push({ token, title: alert.title, url: alert.url });
      return "sent";
    },
  );
  expect(result).toMatchObject({ sent: 1, gone: 0, failed: 0 });
  expect(told).toHaveLength(1);
  expect(told[0]).toMatchObject({
    token: PHONE,
    title: `${SERIES} Vol. 3 is out`,
  });
  // nothing went to the browsers' push service
  expect(delivered).toHaveLength(0);
});

test("a phone whose app is gone is forgotten", async () => {
  const { agent } = await reader();
  await agent.post("/api/push/device").send({ token: PHONE });
  const result = await sendDueAlerts(now, 50, fakeSend, async () => "gone");
  expect(result).toMatchObject({ sent: 0, gone: 1 });
  expect(await prisma.pushSubscription.count()).toBe(0);
});

test("only a real phone token is taken, and only its reader forgets it", async () => {
  const { agent } = await reader();
  for (const token of ["hello", "ExponentPushToken[]", "https://example.com"])
    expect((await agent.post("/api/push/device").send({ token })).status).toBe(
      400,
    );
  await agent.post("/api/push/device").send({ token: PHONE });
  const other = await reader("other");
  await other.agent.post("/api/push/device/forget").send({ token: PHONE });
  expect(await prisma.pushSubscription.count()).toBe(1);
  await agent.post("/api/push/device/forget").send({ token: PHONE });
  expect(await prisma.pushSubscription.count()).toBe(0);
});
