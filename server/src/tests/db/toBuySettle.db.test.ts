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
