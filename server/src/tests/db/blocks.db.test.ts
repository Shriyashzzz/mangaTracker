// Blocking another reader (src/blocks/blocks.ts), with a real database
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

async function reader(name: string) {
  const id = (await userQueries.addUser(name, "a long password"))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: name, password: "a long password" });
  return { agent, id };
}
const share = (id: number, code: string, displayName = "Sam") =>
  prisma.user.update({
    where: { id },
    data: { shareEnabled: true, shareCode: code, displayName },
  });
// a shown review with words, straight into the table
const review = (userId: number, isbn13: string, body: string) =>
  prisma.volumeReview.create({
    data: { userId, isbn13, seriesSlug: "berserk", volume: 1, rating: 4, body },
  });

const ISBN = "9781593070205";

test("blocking a review's writer hides their words from you only", async () => {
  const me = await reader("reader");
  const sam = await reader("samuel");
  const other = await reader("otherone");
  const theirs = await review(sam.id, ISBN, "Loved it");
  await review(other.id, ISBN, "Fine");

  expect(
    (await me.agent.post("/api/blocks").send({ reviewId: theirs.id })).status,
  ).toBe(201);
  // twice is still once
  await me.agent.post("/api/blocks").send({ reviewId: theirs.id });
  expect(await prisma.userBlock.count()).toBe(1);

  const mine = (await me.agent.get(`/api/reviews/volume/${ISBN}`)).body;
  expect(mine.reviews.map((r: { text: string }) => r.text)).toEqual(["Fine"]);
  // their stars still count, as everyone's do
  expect(mine.count).toBe(2);
  // someone else still sees both
  const others = (await other.agent.get(`/api/reviews/volume/${ISBN}`)).body;
  expect(others.reviews).toHaveLength(2);

  // listed with the name readers see, and lifted again
  const list = (await me.agent.get("/api/blocks")).body.blocks;
  // (no display name: the stand-in every reader without one is given,
  // never their username)
  expect(list).toEqual([
    { id: expect.any(Number), name: expect.any(String), avatar: null },
  ]);
  expect(list[0].name).not.toBe("samuel");
  await me.agent.delete(`/api/blocks/${list[0].id}`);
  expect(
    (await me.agent.get(`/api/reviews/volume/${ISBN}`)).body.reviews,
  ).toHaveLength(2);
});

test("a block closes a shared shelf both ways and ends following", async () => {
  const me = await reader("reader");
  const sam = await reader("samuel");
  await share(sam.id, "samshelf");
  await share(me.id, "myshelf", "Me");
  await me.agent.post("/api/share/samshelf/follow");
  await sam.agent.post("/api/share/myshelf/follow");
  expect(await prisma.shelfFollow.count()).toBe(2);

  await me.agent.post("/api/blocks").send({ shareCode: "samshelf" });
  expect(await prisma.shelfFollow.count()).toBe(0);
  // neither opens nor follows the other's
  expect((await me.agent.get("/api/share/samshelf")).status).toBe(404);
  expect((await sam.agent.get("/api/share/myshelf")).status).toBe(404);
  expect((await sam.agent.post("/api/share/myshelf/follow")).status).toBe(404);
  // signed out, it's still open as any shared shelf is
  expect((await request(app).get("/api/share/samshelf")).status).toBe(200);
});

test("only your own blocks: yourself, nobody, someone else's, signed out", async () => {
  const me = await reader("reader");
  const sam = await reader("samuel");
  await share(me.id, "myshelf");
  const mineReview = await review(me.id, ISBN, "Mine");
  expect(
    (await me.agent.post("/api/blocks").send({ reviewId: mineReview.id }))
      .status,
  ).toBe(400);
  expect((await me.agent.post("/api/blocks").send({})).status).toBe(400);
  expect(
    (await me.agent.post("/api/blocks").send({ reviewId: 999999 })).status,
  ).toBe(404);
  await sam.agent.post("/api/blocks").send({ shareCode: "myshelf" });
  const samsBlock = await prisma.userBlock.findFirstOrThrow();
  // not mine to lift
  await me.agent.delete(`/api/blocks/${samsBlock.id}`);
  expect(await prisma.userBlock.count()).toBe(1);
  expect((await request(app).get("/api/blocks")).status).toBe(401);
});
