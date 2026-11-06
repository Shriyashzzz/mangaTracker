// The shelf's routes with a real database: adding, listing, editing, owned
// volumes and deleting, that nobody can touch another reader's series, and
// that each account's manga_count follows along (a database trigger). Light
// novels are used throughout: adding one never asks AniList, so these never
// leave this machine.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

// made directly, then signed in through the route: sign-ups are limited to
// 5 an hour (account.db.test.ts goes through that route)
const reader = async (username: string) => {
  await userQueries.addUser(username, "a good password");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: "a good password" })
    .expect(200);
  return agent;
};
const add = (agent: ReturnType<typeof request.agent>, name: string) =>
  agent.post("/api/manga").send({ name, status: false, lightNovel: true });

const countOf = async (username: string) =>
  (await prisma.user.findUnique({ where: { username } }))?.mangaCount;

test("add, list, edit and delete a series", async () => {
  const agent = await reader("reader");
  const added = await add(agent, "Spice and Wolf");
  expect(added.status).toBe(201);
  const id = added.body.id as number;

  const list = await agent.get("/api/manga");
  expect(list.status).toBe(200);
  expect(list.body.manga.map((m: { name: string }) => m.name)).toEqual([
    "Spice and Wolf",
  ]);

  const edited = await agent.put(`/api/manga/${id}`).send({
    name: "Spice and Wolf",
    status: true,
    lightNovel: true,
    bookmark: 12,
  });
  expect(edited.status).toBe(204);
  const detail = await agent.get(`/api/manga/${id}`);
  expect(detail.body.manga).toMatchObject({ status: true, bookmark: 12 });

  expect((await agent.delete(`/api/manga/${id}`)).status).toBeLessThan(300);
  expect((await agent.get(`/api/manga/${id}`)).status).toBe(404);
});

test("the same series can't go on a shelf twice", async () => {
  const agent = await reader("reader");
  await add(agent, "Spice and Wolf").expect(201);
  const again = await add(agent, "Spice and Wolf");
  expect(again.status).toBe(409);
  expect(await prisma.manga.count()).toBe(1);
});

test("owned volumes: a run from 1, or the exact list with gaps", async () => {
  const agent = await reader("reader");
  const { id } = (await add(agent, "Spice and Wolf")).body;
  await agent
    .put(`/api/manga/${id}/owned`)
    .send({ volumesOwned: 4, ownedList: [1, 2, 3, 4] })
    .expect(200);
  let saved = await prisma.manga.findUnique({ where: { id } });
  expect(saved).toMatchObject({ volumesOwned: 4, ownedList: [] });

  await agent
    .put(`/api/manga/${id}/owned`)
    .send({ volumesOwned: 5, ownedList: [2, 5] })
    .expect(200);
  saved = await prisma.manga.findUnique({ where: { id } });
  expect(saved).toMatchObject({ volumesOwned: 5, ownedList: [2, 5] });
});

// 403, not 404: the details page says "not on your shelf" for both
test("another reader's series can't be read, changed or deleted", async () => {
  const owner = await reader("owner");
  const { id } = (await add(owner, "Spice and Wolf")).body;
  const other = await reader("other");

  expect((await other.get(`/api/manga/${id}`)).status).toBe(403);
  expect(
    (await other.put(`/api/manga/${id}`).send({ name: "Mine", status: true }))
      .status,
  ).toBe(403);
  expect((await other.delete(`/api/manga/${id}`)).status).toBe(403);
  expect(await prisma.manga.count()).toBe(1);
  // and signed out, nothing at all
  expect((await request(app).get(`/api/manga/${id}`)).status).toBe(401);
});

test("manga_count follows every add and delete", async () => {
  const agent = await reader("reader");
  expect(await countOf("reader")).toBe(0);
  const first = (await add(agent, "Spice and Wolf")).body.id;
  await add(agent, "Overlord").expect(201);
  await add(agent, "Mushoku Tensei").expect(201);
  expect(await countOf("reader")).toBe(3);
  await agent.delete(`/api/manga/${first}`);
  expect(await countOf("reader")).toBe(2);
});
