// The shelf's Select: delete or move several series, and the undos
import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/prisma.js";
import { checkRestored, notOnShelf } from "../../controllers/mangaController.js";

afterAll(() => pool.end());

const saved = {
  name: "Berserk",
  status: false,
  bookmark: 0,
  volumesOwned: 14,
  ownedList: [],
  rating: 4,
  seenVolume: 12,
  seenChapter: null,
  seenJapanVolume: null,
  hiddenVolumes: [3, 5],
  latestChapter: 380,
  genre: "Action",
  description: null,
  image: "https://s4.anilist.co/file/a.jpg",
};

test("all need a sign in", async () => {
  for (const path of [
    "/api/manga/delete-many",
    "/api/manga/restore-many",
    "/api/manga/move-many",
    "/api/manga/place-many",
  ]) {
    const res = await request(app).post(path).send({});
    expect(res.status).toBe(401);
  }
});

test("a series sent back is checked by restore's own rules", async () => {
  const back = await checkRestored(saved);
  expect(back).toMatchObject({ name: "Berserk", rating: 4, seenVolume: 12, hiddenVolumes: [3, 5], latestChapter: 380, bookmark: 0 });
  // broken or not a series at all: left out
  expect(await checkRestored({ ...saved, name: "" })).toBeNull();
  expect(await checkRestored({ ...saved, rating: 9 })).toBeNull();
  expect(await checkRestored("Berserk")).toBeNull();
  expect(await checkRestored(null)).toBeNull();
});

test("one added again since, or sent twice, comes back once", async () => {
  const berserk = (await checkRestored(saved))!;
  const monster = (await checkRestored({ ...saved, name: "Monster" }))!;
  const novel = (await checkRestored({ ...saved, name: "Berserk", lightNovel: true }))!;
  const shelf = [{ id: 1, name: "Monster", lightNovel: false }];
  expect(notOnShelf([berserk, monster, berserk, novel], shelf).map((m) => [m.name, m.lightNovel])).toEqual([
    ["Berserk", undefined],
    // the light novel of the same name is its own series
    ["Berserk", true],
  ]);
});
