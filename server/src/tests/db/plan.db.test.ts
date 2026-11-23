// The Collector tier through the real routes and a real database: a free
// account on a device where the limits are on can't add past them, and
// nothing changes anywhere else (src/plan/)
import request from "supertest";
import { app } from "../../app.js";
import config from "../../config/config.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const PASSWORD = "a good password";
const before = config.COLLECTOR_LIMITS_ON;

async function reader(plan = "free") {
  const userId = (await userQueries.addUser("reader", PASSWORD))!;
  await prisma.user.update({ where: { id: userId }, data: { plan } });
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "reader", password: PASSWORD })
    .expect(200);
  return { userId, agent };
}

// a full free shelf: the limit's worth of series, made straight in the database
const fillShelf = (userId: number, count: number) =>
  prisma.manga.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      name: `Series ${i + 1}`,
    })),
  });

beforeEach(async () => {
  await emptyDb();
  config.COLLECTOR_LIMITS_ON = "ios";
});
afterAll(async () => {
  config.COLLECTOR_LIMITS_ON = before;
  await closeDb();
});

test("a new account starts free", async () => {
  const userId = (await userQueries.addUser("newcomer", PASSWORD))!;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user?.plan).toBe("free");
});

test("the plan says what's used and what the limits are, on the iPhone only", async () => {
  const { userId, agent } = await reader();
  await fillShelf(userId, 3);
  const ios = (
    await agent.get("/api/account/plan").set("X-App", "ios").expect(200)
  ).body;
  expect(ios).toMatchObject({
    plan: "free",
    limited: true,
    used: { series: 3 },
    calendar: false,
  });
  const web = (await agent.get("/api/account/plan").expect(200)).body;
  expect(web).toMatchObject({
    plan: "free",
    limited: false,
    limits: null,
    calendar: true,
  });
});

test("a full free shelf can't take another series on the iPhone, and keeps what it has", async () => {
  const { userId, agent } = await reader();
  await fillShelf(userId, 100);
  const refused = await agent
    .post("/api/manga")
    .set("X-App", "ios")
    .send({ name: "One More", status: false });
  expect(refused.status).toBe(402);
  expect(refused.body).toMatchObject({ code: "collector", what: "series" });
  expect(await prisma.manga.count({ where: { userId } })).toBe(100);
  // the same account on the website: no limit
  await agent
    .post("/api/manga")
    .send({ name: "One More", status: false })
    .expect(201);
});

test("a Collector and an early member have no limit", async () => {
  for (const plan of ["collector", "early"]) {
    await emptyDb();
    const { userId, agent } = await reader(plan);
    if (plan === "collector")
      await prisma.user.update({
        where: { id: userId },
        data: { planUntil: new Date(Date.now() + 86_400_000) },
      });
    await fillShelf(userId, 100);
    await agent
      .post("/api/manga")
      .set("X-App", "ios")
      .send({ name: "One More", status: false })
      .expect(201);
  }
});

test("a free account's fourth price alert waits for Collector; changing one never does", async () => {
  const { userId, agent } = await reader();
  const isbns = [
    "9781974700011",
    "9781974700028",
    "9781974700035",
    "9781974700042",
  ];
  await prisma.toBuy.createMany({
    data: isbns.map((isbn13) => ({ userId, isbn13 })),
  });
  for (const isbn of isbns.slice(0, 3))
    await agent
      .patch(`/api/to-buy/${isbn}`)
      .set("X-App", "ios")
      .send({ alertCents: 800 })
      .expect(200);
  const fourth = await agent
    .patch(`/api/to-buy/${isbns[3]}`)
    .set("X-App", "ios")
    .send({ alertCents: 800 });
  expect(fourth.status).toBe(402);
  // one already watched: its price can change, and it can be taken off
  await agent
    .patch(`/api/to-buy/${isbns[0]}`)
    .set("X-App", "ios")
    .send({ alertCents: 650 })
    .expect(200);
  await agent
    .patch(`/api/to-buy/${isbns[0]}`)
    .set("X-App", "ios")
    .send({ alertCents: null })
    .expect(200);
});
