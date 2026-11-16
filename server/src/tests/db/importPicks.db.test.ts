// A series picked by hand for an import title (Edit on a row): the reader's
// own from then on, and shared with everyone once three readers agree. In
// its own file: sign-ins are limited to 10 in 5 minutes.
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../config/prisma.js";
import userQueries from "../../models/userQueries.js";
import { agreedSeries } from "../../util/shelf/importPicks.js";
import { closeDb, emptyDb } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

const reader = async (username: string) => {
  await userQueries.addUser(username, "a good password");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: "a good password" })
    .expect(200);
  return agent;
};

const search = {
  name: "Death Note Black Edition",
  lightNovel: false,
  exactOnly: false,
};
const deathNote = {
  anilistId: 30021,
  malId: 21,
  name: "Death Note",
  cover: null,
};
const pick = (agent: Awaited<ReturnType<typeof reader>>, match: unknown) =>
  agent.post("/api/manga/import/picks").send({ search, match }).expect(204);
const known = async (agent: Awaited<ReturnType<typeof reader>>) =>
  (
    await agent
      .post("/api/manga/import/matches")
      .send({ searches: [search] })
      .expect(200)
  ).body.matches[0];

test("a pick is the reader's own, on their next import", async () => {
  const first = await reader("picker");
  const other = await reader("someoneelse");
  await pick(first, deathNote);
  expect(await known(first)).toEqual(deathNote);
  // nobody else's import sees one reader's pick
  expect(await known(other)).toBeNull();
  // undoing the edit takes it back
  await pick(first, null);
  expect(await known(first)).toBeNull();
});

test("three readers agreeing make it everyone's; two don't", async () => {
  const [a, b, c] = await Promise.all(
    ["voter1", "voter2", "voter3"].map(reader),
  );
  await pick(a!, deathNote);
  await pick(b!, deathNote);
  expect(await agreedSeries(search)).toBeNull();
  // the same reader picking again is still one vote
  await pick(b!, deathNote);
  expect(await agreedSeries(search)).toBeNull();
  // a third picking something else doesn't count toward it
  await pick(c!, { ...deathNote, anilistId: 999, name: "Not It" });
  expect(await agreedSeries(search)).toBeNull();
  await pick(c!, deathNote);
  expect(await agreedSeries(search)).toBe(30021);
});

test("a reader's picks go with their account", async () => {
  const agent = await reader("leaving");
  await pick(agent, deathNote);
  await prisma.user.deleteMany({ where: { username: "leaving" } });
  expect(await prisma.importPick.count()).toBe(0);
});
