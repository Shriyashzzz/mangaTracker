// /api/history/year, with a real database: only the reader's own shelf
import request from "supertest";
import { app } from "../../app.js";
import mangaQueries from "../../models/mangaQueries.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb } from "./testDb.js";

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

test("a reader's year comes from their own shelf only", async () => {
  const me = await reader("reader");
  const other = await reader("other");
  const mine = await mangaQueries.addManga(me.id, {
    name: "Blue Box",
    status: false,
    volumesOwned: 2,
  });
  await mangaQueries.setBookmark(mine, 12);
  await mangaQueries.addManga(other.id, {
    name: "Berserk",
    status: false,
    volumesOwned: 41,
  });

  const res = await me.agent.get("/api/history/year");
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    year: new Date().getUTCFullYear(),
    volumesAdded: 2,
    seriesAdded: 1,
    chaptersRead: 12,
    shelf: { series: 1, volumes: 2 },
  });
  // a year before the history began is answered as this one
  const early = await me.agent.get("/api/history/year?year=1999");
  expect(early.body.year).toBe(new Date().getUTCFullYear());
});

test("signed out: refused", async () => {
  expect((await request(app).get("/api/history/year")).status).toBe(401);
});
