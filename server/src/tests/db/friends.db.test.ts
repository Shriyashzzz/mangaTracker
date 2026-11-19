// Following shared shelves (src/friends/friends.ts), with a real database
import request from "supertest";
import { app } from "../../app.js";
import mangaQueries from "../../models/mangaQueries.js";
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

test("following a shared shelf lists it in Friends, with its size", async () => {
  const me = await reader("reader");
  const sam = await reader("sam");
  await share(sam.id, "samshelf");
  await mangaQueries.addManga(sam.id, {
    name: "Berserk",
    status: false,
    volumesOwned: 41,
  });

  expect((await me.agent.get("/api/share/samshelf")).body.following).toBe(
    false,
  );
  expect((await me.agent.post("/api/share/samshelf/follow")).body).toEqual({
    following: true,
  });
  // twice is still once
  await me.agent.post("/api/share/samshelf/follow");
  expect((await me.agent.get("/api/share/samshelf")).body.following).toBe(true);
  expect((await me.agent.get("/api/friends")).body.friends).toEqual([
    { code: "samshelf", name: "Sam", avatar: null, series: 1, volumes: 41 },
  ]);

  // sharing off: not listed; unfollowing still works by the code
  await prisma.user.update({
    where: { id: sam.id },
    data: { shareEnabled: false },
  });
  expect((await me.agent.get("/api/friends")).body.friends).toEqual([]);
  await me.agent.delete("/api/share/samshelf/follow");
  expect(await prisma.shelfFollow.count()).toBe(0);
});

test("your own shelf, one not shared, or signed out: refused", async () => {
  const me = await reader("reader");
  await share(me.id, "myshelf");
  expect((await me.agent.post("/api/share/myshelf/follow")).status).toBe(400);
  expect((await me.agent.post("/api/share/nothere/follow")).status).toBe(404);
  expect((await request(app).post("/api/share/myshelf/follow")).status).toBe(
    401,
  );
  expect((await request(app).get("/api/friends")).status).toBe(401);
});
