// "I bought it" and "I ordered it" on the To buy list (toBuy/toBuy.ts
// settleToBuy), through the real route and a real database: the book comes
// off the list, and only certain volumes of a series on the shelf are
// touched. Never a guess: an edition's book whose title doesn't say what it
// holds, or a series not on the shelf, is only taken off the list.
import request from "supertest";
import { app } from "../../app.js";
import mangaQueries from "../../models/mangaQueries.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { volumesOf } from "../../toBuy/toBuy.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const ISBNS: string[] = [];
const book = async (isbn13: string, title: string) => {
  ISBNS.push(isbn13);
  await priceQueries.upsertBook({
    isbn13,
    title,
    authors: null,
    publisher: null,
    year: 2020,
    coverUrl: null,
  });
};

async function reader() {
  const id = (await userQueries.addUser("reader", "a long password"))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "reader", password: "a long password" });
  return { agent, id };
}
const settle = (
  agent: ReturnType<typeof request.agent>,
  isbn: string,
  how: string,
) => agent.post(`/api/to-buy/${isbn}/settle`).send({ how });

beforeEach(emptyDb);
afterAll(async () => {
  await prisma.book.deleteMany({ where: { isbn13: { in: ISBNS } } });
  await closeDb();
});

test("the volumes a book certainly holds, never a guess", () => {
  expect(volumesOf("Zzsettle Saga, Vol. 12")).toEqual([12]);
  // an edition's book is never read as volume 3
  expect(volumesOf("Zzsettle Saga Deluxe Edition, Vol. 3")).toBeNull();
  expect(volumesOf("Zzsettle Saga (VIZBIG Edition), Vol. 4")).toBeNull();
  // unless its title says what it holds
  expect(
    volumesOf(
      "Zzsettle Saga (3-in-1 Edition), Vol. 7: Includes vols. 19, 20 & 21",
    ),
  ).toEqual([19, 20, 21]);
  expect(volumesOf("Zzsettle Saga Box Set")).toBeNull();
});

test("bought and ordered single volumes: owned, on order, off the list", async () => {
  const { agent, id } = await reader();
  const manga = await mangaQueries.addManga(id, {
    name: "Zzsettle Saga",
    status: false,
    volumesOwned: 3,
  });
  await book("9781999996401", "Zzsettle Saga, Vol. 4");
  await book("9781999996402", "Zzsettle Saga, Vol. 5");
  await agent.put("/api/to-buy/9781999996401");
  await agent.put("/api/to-buy/9781999996402");

  // the list says nothing's settled yet
  const before = (await agent.get("/api/to-buy")).body.items;
  expect(before.map((i: { shelf: unknown }) => i.shelf)).toEqual([
    { id: manga, name: "Zzsettle Saga", state: null },
    { id: manga, name: "Zzsettle Saga", state: null },
  ]);

  const bought = await settle(agent, "9781999996401", "owned");
  expect(bought.body).toMatchObject({ done: "owned", volumes: [4] });
  const ordered = await settle(agent, "9781999996402", "ordered");
  expect(ordered.body).toMatchObject({ done: "ordered", volumes: [5] });

  const now = (await mangaQueries.getManga(manga))!;
  expect(now.volumesOwned).toBe(4);
  expect(now.orderedList).toEqual([5]);
  expect((await agent.get("/api/to-buy")).body.items).toEqual([]);
});

test("an edition's book: only what its title says, else nothing on the shelf", async () => {
  const { agent, id } = await reader();
  const manga = await mangaQueries.addManga(id, {
    name: "Zzsettle Saga",
    status: false,
    volumesOwned: 3,
  });
  await book("9781999996403", "Zzsettle Saga Deluxe Edition, Vol. 3");
  await book(
    "9781999996404",
    "Zzsettle Saga (3-in-1 Edition), Vol. 7: Includes vols. 19, 20 & 21",
  );
  await agent.put("/api/to-buy/9781999996403");
  await agent.put("/api/to-buy/9781999996404");

  const unsure = await settle(agent, "9781999996403", "owned");
  expect(unsure.body).toMatchObject({
    done: null,
    shelf: { id: manga, name: "Zzsettle Saga" },
    volumes: null,
  });
  // the shelf is as it was: vol. 3 is not taken to be Deluxe 3
  expect((await mangaQueries.getManga(manga))!.volumesOwned).toBe(3);

  const sure = await settle(agent, "9781999996404", "owned");
  expect(sure.body).toMatchObject({ done: "owned", volumes: [19, 20, 21] });
  const owned = (await mangaQueries.getManga(manga))!;
  expect(owned.ownedList).toEqual([1, 2, 3, 19, 20, 21]);
});

test("a series not on the shelf: off the list, nothing added", async () => {
  const { agent, id } = await reader();
  await book("9781999996405", "Zzelsewhere Tales, Vol. 2");
  await agent.put("/api/to-buy/9781999996405");
  const res = await settle(agent, "9781999996405", "owned");
  expect(res.body).toEqual({
    done: null,
    series: "Zzelsewhere Tales",
    shelf: null,
    volumes: [2],
  });
  expect(await prisma.manga.count({ where: { userId: id } })).toBe(0);
  expect((await agent.get("/api/to-buy")).body.items).toEqual([]);
});

test("the list says what's already owned or on order; not on the list: 404", async () => {
  const { agent, id } = await reader();
  const manga = await mangaQueries.addManga(id, {
    name: "Zzsettle Saga",
    status: false,
    volumesOwned: 4,
  });
  await mangaQueries.setOrdered(manga, [5]);
  await book("9781999996406", "Zzsettle Saga, Vol. 4");
  await book("9781999996407", "Zzsettle Saga, Vol. 5");
  await agent.put("/api/to-buy/9781999996406");
  await agent.put("/api/to-buy/9781999996407");
  const states = Object.fromEntries(
    (await agent.get("/api/to-buy")).body.items.map(
      (i: { volume: number; shelf: { state: string } }) => [
        i.volume,
        i.shelf.state,
      ],
    ),
  );
  expect(states).toEqual({ 4: "owned", 5: "ordered" });
  expect((await settle(agent, "9781999996499", "owned")).status).toBe(404);
  expect((await settle(agent, "9781999996406", "maybe")).status).toBe(400);
});

// ---------- "Add it to your shelf?" (addFromToBuy) ----------
const addSeries = (
  agent: ReturnType<typeof request.agent>,
  isbn: string,
  body: object,
) => agent.post(`/api/to-buy/${isbn}/add-series`).send(body);

test("adding the series: To read, with the bought volume, once", async () => {
  const { agent, id } = await reader();
  await book("9781999996410", "Zzadd Chronicle, Vol. 2");
  const res = await addSeries(agent, "9781999996410", {
    name: "Zzadd Chronicle",
    planned: true,
    how: "owned",
  });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ added: true, done: "owned", volumes: [2] });
  const made = (await mangaQueries.getManga(res.body.id))!;
  expect(made).toMatchObject({ userId: id, planned: true, status: false });
  // vol. 2 alone, not 1 to 2
  expect(made.ownedList).toEqual([2]);

  // asked again (a second tap, another tab): not added twice
  const again = await addSeries(agent, "9781999996410", {
    name: "zzadd chronicle",
    planned: true,
    how: "owned",
  });
  expect(again.status).toBe(200);
  expect(again.body).toMatchObject({ added: false, id: res.body.id });
  expect(await prisma.manga.count({ where: { userId: id } })).toBe(1);
});

test("two at the same moment add one series", async () => {
  const { agent, id } = await reader();
  await book("9781999996411", "Zzadd Twins, Vol. 1");
  const body = { name: "Zzadd Twins", planned: true, how: "owned" };
  const [a, b] = await Promise.all([
    addSeries(agent, "9781999996411", body),
    addSeries(agent, "9781999996411", body),
  ]);
  expect([a.body.added, b.body.added].sort()).toEqual([false, true]);
  expect(await prisma.manga.count({ where: { userId: id } })).toBe(1);
});

test("ordered: on order, not owned; an edition's book: no volumes guessed", async () => {
  const { agent } = await reader();
  await book("9781999996412", "Zzadd Voyage, Vol. 5");
  await book("9781999996413", "Zzadd Epic Deluxe Edition, Vol. 3");
  const ordered = await addSeries(agent, "9781999996412", {
    name: "Zzadd Voyage",
    planned: true,
    how: "ordered",
  });
  const voyage = (await mangaQueries.getManga(ordered.body.id))!;
  expect(voyage.orderedList).toEqual([5]);
  expect(voyage.ownedList).toEqual([]);
  expect(voyage.volumesOwned).toBeNull();

  const deluxe = await addSeries(agent, "9781999996413", {
    name: "Zzadd Epic",
    planned: false,
    how: "owned",
  });
  expect(deluxe.body).toMatchObject({ added: true, done: null, volumes: null });
  const epic = (await mangaQueries.getManga(deluxe.body.id))!;
  expect(epic.volumesOwned).toBeNull();
  expect(epic.planned).toBe(false);
});

test("a light novel is added as one, beside the manga of the same name", async () => {
  const { agent, id } = await reader();
  await mangaQueries.addManga(id, { name: "Zzadd Academy", status: false });
  await book("9781999996414", "Zzadd Academy (Light Novel) Vol. 2");
  const res = await addSeries(agent, "9781999996414", {
    name: "Zzadd Academy",
    planned: true,
    how: "owned",
  });
  expect(res.body.added).toBe(true);
  expect((await mangaQueries.getManga(res.body.id))!.lightNovel).toBe(true);
  expect(await prisma.manga.count({ where: { userId: id } })).toBe(2);
});

test("a bad name, an unknown book, or signed out: refused, nothing added", async () => {
  const { agent, id } = await reader();
  await book("9781999996415", "Zzadd Quiet, Vol. 1");
  const ok = { planned: true, how: "owned" };
  expect(
    (await addSeries(agent, "9781999996415", { ...ok, name: "   " })).status,
  ).toBe(400);
  expect(
    (await addSeries(agent, "9781999996415", { ...ok, name: "x".repeat(151) }))
      .status,
  ).toBe(400);
  expect(
    (
      await addSeries(agent, "9781999996415", {
        ...ok,
        name: "Zzadd",
        how: "both",
      })
    ).status,
  ).toBe(400);
  expect(
    (await addSeries(agent, "9781999996499", { ...ok, name: "Zzadd Quiet" }))
      .status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post("/api/to-buy/9781999996415/add-series")
        .send({ ...ok, name: "Zzadd Quiet" })
    ).status,
  ).toBe(401);
  expect(await prisma.manga.count({ where: { userId: id } })).toBe(0);
});

test("a light novel bought never ticks the manga of the same name", async () => {
  const { agent, id } = await reader();
  const manga = await mangaQueries.addManga(id, {
    name: "Zzadd Lantern",
    status: false,
    volumesOwned: 1,
  });
  await book("9781999996416", "Zzadd Lantern (Light Novel) Vol. 2");
  await agent.put("/api/to-buy/9781999996416");
  const res = await settle(agent, "9781999996416", "owned");
  expect(res.body).toMatchObject({ done: null, shelf: null });
  expect((await mangaQueries.getManga(manga))!.volumesOwned).toBe(1);
});

test("the volumes ticked come too; an edition's book sets the edition; a place when reading", async () => {
  const { agent } = await reader();
  await book("9781999996417", "Zzadd Harbor, Vol. 3");
  await book("9781999996418", "Zzadd Summit Deluxe Edition, Vol. 2");
  await book("9781999996419", "Zzadd Garden, Vol. 4");
  const bought = await addSeries(agent, "9781999996417", {
    name: "Zzadd Harbor",
    planned: false,
    how: "owned",
    owned: [1, 2],
    bookmark: 30,
  });
  const harbor = (await mangaQueries.getManga(bought.body.id))!;
  expect(harbor.volumesOwned).toBe(3);
  expect(harbor.ownedList).toEqual([]);
  expect(harbor.bookmark).toBe(30);
  expect(harbor.planned).toBe(false);

  const deluxe = await addSeries(agent, "9781999996418", {
    name: "Zzadd Summit",
    planned: true,
    how: "owned",
  });
  expect((await mangaQueries.getManga(deluxe.body.id))!.edition).toBe("deluxe");

  // ordered: the book on order, the ticked ones owned; To read keeps no place
  const ordered = await addSeries(agent, "9781999996419", {
    name: "Zzadd Garden",
    planned: true,
    how: "ordered",
    owned: [1],
    bookmark: 99,
  });
  const garden = (await mangaQueries.getManga(ordered.body.id))!;
  expect(garden.volumesOwned).toBe(1);
  expect(garden.orderedList).toEqual([4]);
  expect(garden.bookmark).toBe(0);

  // a volume that isn't one is refused
  expect(
    (
      await addSeries(agent, "9781999996417", {
        name: "Zzadd Harbor",
        planned: true,
        how: "owned",
        owned: [1000],
      })
    ).status,
  ).toBe(400);
});
