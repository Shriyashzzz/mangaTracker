// The shelf's own order, "Last updated", with a real database: a series the
// reader changes goes to the top, and what the site does on its own (a
// release check) or hiding a card moves nothing. In its own file: sign-ins
// are limited to 10 in 5 minutes, and shelf.db.test.ts uses them up.
import request from "supertest";
import { app } from "../../app.js";
import mangaQueries from "../../models/mangaQueries.js";
import userQueries from "../../models/userQueries.js";
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
// light novels: adding one never asks AniList, so this never leaves the machine
const add = (agent: ReturnType<typeof request.agent>, name: string) =>
  agent.post("/api/manga").send({ name, status: false, lightNovel: true });

test("the shelf comes back with the series changed last, first", async () => {
  const agent = await reader("sorter");
  const first = (await add(agent, "Overlord")).body.id as number;
  const second = (await add(agent, "Spice and Wolf")).body.id as number;
  const third = (await add(agent, "Baccano")).body.id as number;
  const order = async () =>
    (await agent.get("/api/manga")).body.manga.map(
      (m: { id: number }) => m.id,
    ) as number[];

  // nothing changed yet: the one added last is first
  expect(await order()).toEqual([third, second, first]);

  // the reader moves their bookmark in the oldest: it goes to the top
  await mangaQueries.setBookmark(first, 12);
  expect(await order()).toEqual([first, third, second]);

  // then rates another: that one goes above it
  await mangaQueries.setRating(second, 4);
  expect(await order()).toEqual([second, first, third]);

  // what the site does on its own, and hiding a card, moves nothing
  await mangaQueries.setLatestChapter(third, 99);
  await mangaQueries.setSeen(third, "chapter", 99);
  expect(await order()).toEqual([second, first, third]);
});

test("an import brings each series' own date, and the shelf's order with it", async () => {
  const agent = await reader("importer");
  const entry = (title: string, updatedAt?: string) => ({
    title,
    finished: false,
    chapters: 1,
    readVolumes: 0,
    ownedVolumes: 0,
    score: 0,
    lightNovel: true,
    ...(updatedAt ? { updatedAt } : {}),
  });
  await agent
    .post("/api/manga/import")
    .send({
      entries: [
        entry("Changed long ago", "2019-04-01T00:00:00.000Z"),
        entry("Changed last year", "2025-06-01T00:00:00.000Z"),
        // no date, and one in the future: both get the time of the import
        entry("No date"),
        entry("From the future", "2031-01-01T00:00:00.000Z"),
      ],
    })
    .expect(200);
  const names = (await agent.get("/api/manga")).body.manga.map(
    (m: { name: string }) => m.name,
  ) as string[];
  // the two with no usable date are the newest; then by their own dates
  expect(names.slice(2)).toEqual(["Changed last year", "Changed long ago"]);
  expect(names.slice(0, 2).sort()).toEqual(["From the future", "No date"]);
});
