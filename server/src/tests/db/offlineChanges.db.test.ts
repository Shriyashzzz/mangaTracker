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
  expect((await send(agent, [{ kind: "delete", mangaId: 1 }])).status).toBe(
    400,
  );
  expect(
    (await send(agent, [{ kind: "bookmark", mangaId: 1, from: 1, to: -4 }]))
      .status,
  ).toBe(400);
});

test("finished, To read, rating and notes made offline are saved", async () => {
  const { agent, id } = await reader("reader");
  const manga = await series(id, {
    planned: true,
    rating: 3,
    description: "old",
  });
  const res = await send(agent, [
    {
      kind: "state",
      mangaId: manga.id,
      from: { status: false, planned: true },
      to: { status: true, planned: false },
    },
    { kind: "rating", mangaId: manga.id, from: 3, to: 5 },
    { kind: "notes", mangaId: manga.id, from: "old", to: "read on a train" },
  ]);
  expect(res.status).toBe(200);
  expect(res.body.answers.every((a: { saved: boolean }) => a.saved)).toBe(true);
  const now = await prisma.manga.findUniqueOrThrow({ where: { id: manga.id } });
  expect(now.planned).toBe(false);
  expect(now.status).toBe(true);
  expect(now.rating).toBe(5);
  expect(now.description).toBe("read on a train");
});

test("changed on another device meanwhile: that stays, notes kept both", async () => {
  const { agent, id } = await reader("reader");
  // the laptop, since: un-rated to 2, and wrote its own note
  const manga = await series(id, { rating: 2, description: "laptop note" });
  await send(agent, [
    { kind: "rating", mangaId: manga.id, from: 3, to: 5 },
    { kind: "notes", mangaId: manga.id, from: "old", to: "phone note" },
  ]);
  const now = await prisma.manga.findUniqueOrThrow({ where: { id: manga.id } });
  expect(now.rating).toBe(2);
  expect(now.description).toBe("laptop note\n\nphone note (written offline)");
});

test("a change of an unknown kind or shape refuses the whole send", async () => {
  const { agent, id } = await reader("reader");
  const manga = await series(id);
  const res = await send(agent, [
    { kind: "rating", mangaId: manga.id, from: 3, to: 5 },
    { kind: "state", mangaId: manga.id, from: "yes", to: true },
  ]);
  expect(res.status).toBe(400);
  const now = await prisma.manga.findUniqueOrThrow({ where: { id: manga.id } });
  expect(now.rating).toBe(null);
});

test("started reading offline: off To read and at chapter 1, never back", async () => {
  const { agent, id } = await reader("reader");
  const manga = await series(id, { planned: true, bookmark: 0 });
  await send(agent, [
    {
      kind: "state",
      mangaId: manga.id,
      from: { status: false, planned: true },
      to: { status: false, planned: false },
    },
  ]);
  let now = await prisma.manga.findUniqueOrThrow({ where: { id: manga.id } });
  expect(now).toMatchObject({ planned: false, status: false, bookmark: 1 });
  // a series already past chapter 1 keeps its place
  const ahead = await series(id, {
    name: "Dandadan",
    planned: true,
    bookmark: 40,
  });
  await send(agent, [
    {
      kind: "state",
      mangaId: ahead.id,
      from: { status: false, planned: true },
      to: { status: false, planned: false },
    },
  ]);
  now = await prisma.manga.findUniqueOrThrow({ where: { id: ahead.id } });
  expect(now.bookmark).toBe(40);
});
