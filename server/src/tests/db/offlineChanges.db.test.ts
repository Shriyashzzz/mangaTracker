// Changes made offline, sent once the app is back online, with a real
// database (src/offline/offlineChanges.ts)
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
const series = (userId: number, data: object = {}) =>
  prisma.manga.create({
    data: { userId, name: "Blue Box", volumesOwned: 3, bookmark: 20, ...data },
  });
const send = (agent: ReturnType<typeof request.agent>, changes: object[]) =>
  agent.post("/api/manga/offline-changes").send({ changes });

test("the phone's changes are put with the laptop's, never over them", async () => {
  const { agent, id } = await reader("reader");
  const manga = await series(id);
  // meanwhile on the laptop: vol. 2 taken off, chapter moved on to 25
  await prisma.manga.update({
    where: { id: manga.id },
    data: { ownedList: [1, 3], volumesOwned: 3, bookmark: 25 },
  });

  const res = await send(agent, [
    {
      kind: "owned",
      mangaId: manga.id,
      started: [1, 2, 3],
      ended: [1, 2, 3, 4],
    },
    { kind: "bookmark", mangaId: manga.id, from: 20, to: 21 },
    { kind: "readVolume", mangaId: manga.id, from: null, to: 2 },
  ]);
  expect(res.status).toBe(200);
  expect(res.body.answers).toEqual([
    { saved: true },
    { saved: true },
    { saved: true },
  ]);
  const now = await prisma.manga.findUniqueOrThrow({ where: { id: manga.id } });
  expect(now.ownedList).toEqual([1, 3, 4]);
  expect(now.bookmark).toBe(25);
  expect(now.readVolume).toBe(2);
});

test("someone else's series, or one deleted since, isn't touched", async () => {
  const owner = await reader("owner");
  const theirs = await series(owner.id);
  const { agent } = await reader("other");

  const res = await send(agent, [
    { kind: "bookmark", mangaId: theirs.id, from: 20, to: 99 },
    { kind: "bookmark", mangaId: 999999, from: 1, to: 2 },
  ]);
  expect(res.body.answers).toEqual([
    { saved: false, reason: "gone" },
    { saved: false, reason: "gone" },
  ]);
  const still = await prisma.manga.findUniqueOrThrow({
    where: { id: theirs.id },
  });
  expect(still.bookmark).toBe(20);
});

test("signed out, or nothing sensible sent: refused whole", async () => {
  const signedOut = await request(app)
    .post("/api/manga/offline-changes")
    .send({ changes: [{ kind: "bookmark", mangaId: 1, from: 1, to: 2 }] });
  expect(signedOut.status).toBe(401);

  const { agent } = await reader("reader");
  expect((await send(agent, [])).status).toBe(400);
  expect(
    (await send(agent, [{ kind: "rating", mangaId: 1, to: 5 }])).status,
  ).toBe(400);
  expect(
    (await send(agent, [{ kind: "bookmark", mangaId: 1, from: 1, to: -4 }]))
      .status,
  ).toBe(400);
});
