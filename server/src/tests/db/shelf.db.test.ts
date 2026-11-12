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

  // their place by the volume: the chapter keeps its own number
  await agent
    .patch(`/api/manga/${id}/reading`)
    .send({ byVolume: true, readVolume: 4 })
    .expect(204);
  await agent
    .patch(`/api/manga/${id}/reading`)
    .send({ readVolume: 5 })
    .expect(204);
  await agent
    .patch(`/api/manga/${id}/reading`)
    .send({ readVolume: 1000 })
    .expect(400);
  expect((await agent.get(`/api/manga/${id}`)).body.manga).toMatchObject({
    byVolume: true,
    readVolume: 5,
    bookmark: 12,
  });

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

  // the books behind them: kept only while their volumes are owned
  const deluxe = { edition: "deluxe", number: 1, volumes: [1, 2, 3] };
  const five = { isbn13: "9781421500058", edition: "single", volumes: [5] };
  await agent
    .put(`/api/manga/${id}/owned`)
    .send({ volumesOwned: 5, ownedList: [1, 2, 3, 5] })
    .expect(200);
  const booked = await agent
    .post(`/api/manga/${id}/books`)
    .send({ books: [deluxe, five, { edition: "single", volumes: [9] }] })
    .expect(200);
  // vol. 9 isn't owned, so its book isn't kept
  expect(booked.body.books).toMatchObject([deluxe, five]);
  // the same books again add nothing; an ISBN fills in where there was none
  const again = await agent
    .post(`/api/manga/${id}/books`)
    .send({ books: [{ ...deluxe, isbn13: "9781506711980" }, five] })
    .expect(200);
  expect(again.body.books).toMatchObject([
    { ...deluxe, isbn13: "9781506711980" },
    five,
  ]);
  await agent
    .post(`/api/manga/${id}/books`)
    .send({ books: [{ edition: "paperback", volumes: [1] }] })
    .expect(400);
  // a book removed takes the volumes only it held
  const left = await agent
    .delete(`/api/manga/${id}/books/${again.body.books[0].id}`)
    .expect(200);
  expect(left.body).toMatchObject({ volumesOwned: 5, ownedList: [5] });
  // unticking a volume by hand drops the book that held it
  await agent.put(`/api/manga/${id}/owned`).send({ ownedList: [] }).expect(200);
  expect((await agent.get(`/api/manga/${id}/books`)).body.books).toEqual([]);
  expect((await agent.get("/api/manga/books")).body.books).toEqual([]);

  // deleted with its books, and the undo brings both back
  await agent
    .put(`/api/manga/${id}/owned`)
    .send({ volumesOwned: 3, ownedList: [1, 2, 3] })
    .expect(200);
  await agent.post(`/api/manga/${id}/books`).send({ books: [deluxe] });
  const gone = await agent
    .post("/api/manga/delete-many")
    .send({ ids: [id] })
    .expect(200);
  expect(gone.body.manga[0].books).toMatchObject([deluxe]);
  const { books: had, ...whole } = gone.body.manga[0];
  const rest = { ...whole, id: undefined, userId: undefined };
  await agent
    .post("/api/manga/restore-many")
    .send({ manga: [{ ...rest, books: had.map(() => deluxe) }] })
    .expect(200);
  expect((await agent.get("/api/manga/books")).body.books).toMatchObject([
    deluxe,
  ]);
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

test("importing a series already there adds its new volumes, never takes any away", async () => {
  const agent = await reader("reader");
  const { id } = (
    await agent
      .post("/api/manga")
      .send({ name: "Zzmerge Series", status: false })
      .expect(201)
  ).body;
  await agent
    .put(`/api/manga/${id}/owned`)
    .send({ volumesOwned: 8, ownedList: [1, 2, 3, 4, 5, 8] })
    .expect(200);
  const entry = {
    title: "Zzmerge Series",
    finished: false,
    chapters: 0,
    readVolumes: 0,
    ownedVolumes: 7,
    ownedList: [6, 7],
    score: 0,
  };
  const first = await agent
    .post("/api/manga/import")
    .send({ entries: [entry] })
    .expect(200);
  expect(first.body).toMatchObject({
    added: 0,
    alreadyThere: 1,
    volumesAdded: 1,
  });
  // 1-5, 8 and the imported 6-7: a run from 1 to 8
  expect(await prisma.manga.findUnique({ where: { id } })).toMatchObject({
    volumesOwned: 8,
    ownedList: [],
  });
  expect(await prisma.manga.count()).toBe(1);

  // the same file again: nothing new, nothing changed
  const again = await agent
    .post("/api/manga/import")
    .send({ entries: [{ ...entry, ownedVolumes: 3, ownedList: [] }] })
    .expect(200);
  expect(again.body.volumesAdded).toBe(0);
  expect(await prisma.manga.findUnique({ where: { id } })).toMatchObject({
    volumesOwned: 8,
    ownedList: [],
  });

  // under another of its names (the file says "Case Closed", the shelf
  // "Detective Conan"): found, not added twice
  await agent
    .post("/api/manga")
    .send({ name: "Zzdetective Conan", status: false })
    .expect(201);
  // the file calls it by its other name; the import says both
  const other = await agent
    .post("/api/manga/import")
    .send({
      entries: [
        {
          title: "Zzcase Closed",
          otherNames: ["Zzdetective Conan"],
          finished: false,
          chapters: 0,
          readVolumes: 0,
          ownedVolumes: 3,
          score: 0,
        },
      ],
    })
    .expect(200);
  expect(other.body).toMatchObject({
    added: 0,
    alreadyThere: 1,
    volumesAdded: 1,
  });
  const names = await agent.get("/api/manga").expect(200);
  const allNames = names.body.manga ?? names.body;
  expect(
    allNames
      .map((m: { name: string }) => m.name)
      .filter((n: string) => /Zzdetective|Zzcase/.test(n)),
  ).toEqual(["Zzdetective Conan"]);
});

test("stars given when adding a series are saved, and are optional", async () => {
  const agent = await reader("reader");
  const rated = await agent
    .post("/api/manga")
    .send({ name: "Zzrated", status: true, rating: 4 })
    .expect(201);
  expect(
    await prisma.manga.findUnique({ where: { id: rated.body.id } }),
  ).toMatchObject({ rating: 4 });
  // no chapter and no stars: still added
  await agent
    .post("/api/manga")
    .send({ name: "Zzunrated", status: false })
    .expect(201);
  await agent
    .post("/api/manga")
    .send({ name: "Zzbad", status: true, rating: 9 })
    .expect(400);
});

test("a series on the shelf twice merges into one, keeping everything either had", async () => {
  const agent = await reader("reader");
  const a = await prisma.manga.create({
    data: {
      userId: (await prisma.user.findFirst())!.id,
      name: "Zztwice",
      volumesOwned: 5,
      bookmark: 40,
      description: "first",
    },
  });
  const b = await prisma.manga.create({
    data: {
      userId: a.userId,
      name: "Zztwice",
      volumesOwned: 8,
      ownedList: [7, 8],
      bookmark: 55,
      rating: 4,
      description: "second",
    },
  });
  await agent
    .post(`/api/manga/${a.id}/merge`)
    .send({ otherId: b.id })
    .expect(204);
  expect(await prisma.manga.count()).toBe(1);
  // 1-5 and 7-8: the gap at 6 stays a gap
  expect(await prisma.manga.findUnique({ where: { id: a.id } })).toMatchObject({
    volumesOwned: 8,
    ownedList: [1, 2, 3, 4, 5, 7, 8],
    bookmark: 55,
    rating: 4,
    description: "first\nsecond",
  });
});

test("merging only works with a series on your own shelf", async () => {
  const mine = await reader("reader");
  // another reader's series, made directly: no second sign-in needed
  const someone = await userQueries.addUser("someone", "a good password");
  const { id: myId } = (await add(mine, "Zzmine")).body;
  const { id: theirId } = await prisma.manga.create({
    data: { userId: someone!, name: "Zztheirs" },
  });
  await mine
    .post(`/api/manga/${myId}/merge`)
    .send({ otherId: theirId })
    .expect(404);
  await mine
    .post(`/api/manga/${myId}/merge`)
    .send({ otherId: myId })
    .expect(404);
  expect(await prisma.manga.count()).toBe(2);
});
