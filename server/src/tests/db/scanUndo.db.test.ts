// A scan taken back off the shelf: the page's own steps (client/src/lib/
// scanUndo.ts) run against the real routes and a real database. Found by
// scanning as a collector would: two editions of the same volumes, and one
// undone. No catalog or store is called.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import {
  takeBack,
  takeBackSeries,
  type Shelf,
} from "../../../../client/src/lib/scanUndo.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const PASSWORD = "a good password";
const VIZBIG = { isbn13: "9781421520544", volumes: [1, 2, 3] };
const DEFINITIVE = { isbn13: "9781974752584", volumes: [1, 2, 3] };

beforeEach(emptyDb);
afterAll(closeDb);

// signed in, with the shelf an undo reads and saves through the routes
const collector = async () => {
  const userId = (await userQueries.addUser("collector", PASSWORD))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "collector", password: PASSWORD })
    .expect(200);
  const shelf: Shelf = {
    ownedNow: async (id) => (await agent.get(`/api/manga/${id}`)).body.manga,
    setOwned: (id, owned) =>
      agent.put(`/api/manga/${id}/owned`).send(owned).expect(200),
    books: async (id) => (await agent.get(`/api/manga/${id}/books`)).body.books,
    removeBook: async (id, bookId) =>
      (await agent.delete(`/api/manga/${id}/books/${bookId}`).expect(200)).body,
    removeSeries: async (id) => {
      await agent.delete(`/api/manga/${id}`).expect(204);
    },
  };
  return { userId, shelf };
};

// Vagabond on the shelf with these volumes and books
const vagabond = (
  userId: number,
  ownedList: number[],
  books: { isbn13?: string; title: string; volumes: number[] }[],
) =>
  prisma.manga.create({
    data: {
      userId,
      name: "Vagabond",
      ownedList,
      books: {
        create: books.map((b) => ({
          ...b,
          edition: b.volumes.length > 1 ? "deluxe" : "single",
        })),
      },
    },
  });

const now = async (id: number) => {
  const manga = await prisma.manga.findUnique({
    where: { id },
    include: { books: true },
  });
  return (
    manga && {
      // a run from vol. 1 is saved as "up to" its last (ownedList.ts)
      owned: manga.ownedList.length ? manga.ownedList : manga.volumesOwned,
      books: manga.books.map((b) => b.title).sort(),
    }
  );
};

test("undoing one edition's book keeps the volumes another edition holds", async () => {
  const { userId, shelf } = await collector();
  const { id } = await vagabond(
    userId,
    [1, 2, 3],
    [
      { ...VIZBIG, title: "Vagabond (VIZBIG Edition), Vol. 1" },
      { ...DEFINITIVE, title: "Vagabond Definitive Edition, Vol. 1" },
      { title: "Vagabond, Vol. 2", volumes: [2] },
    ],
  );

  // the VIZBIG scan had put the series on the shelf
  await takeBackSeries(shelf, id, VIZBIG);

  expect(await now(id)).toEqual({
    owned: 3,
    books: ["Vagabond Definitive Edition, Vol. 1", "Vagabond, Vol. 2"],
  });
});

test("the series goes when the scanned book is all there is of it", async () => {
  const { userId, shelf } = await collector();
  const { id } = await vagabond(
    userId,
    [1, 2, 3],
    [{ ...VIZBIG, title: "Vagabond (VIZBIG Edition), Vol. 1" }],
  );

  await takeBackSeries(shelf, id, VIZBIG);

  expect(await now(id)).toBeNull();
});

test("a later scan's volume keeps the series, less the book undone", async () => {
  const { userId, shelf } = await collector();
  const { id } = await vagabond(
    userId,
    [1, 2, 3, 4],
    [
      { ...VIZBIG, title: "Vagabond (VIZBIG Edition), Vol. 1" },
      { title: "Vagabond, Vol. 4", volumes: [4] },
    ],
  );

  await takeBackSeries(shelf, id, VIZBIG);

  expect(await now(id)).toEqual({ owned: [4], books: ["Vagabond, Vol. 4"] });
});

test("a volume ticked by hand before the scan stays theirs", async () => {
  const { userId, shelf } = await collector();
  // vol. 2 was theirs; the VIZBIG scan added 1 and 3
  const { id } = await vagabond(
    userId,
    [1, 2, 3],
    [{ ...VIZBIG, title: "Vagabond (VIZBIG Edition), Vol. 1" }],
  );

  await takeBack(shelf, id, VIZBIG, [1, 3]);

  expect(await now(id)).toEqual({ owned: [2], books: [] });
});

test("a scan whose book was never saved still takes its volumes back", async () => {
  const { userId, shelf } = await collector();
  const { id } = await vagabond(
    userId,
    [1, 2, 3],
    [{ ...DEFINITIVE, title: "Vagabond Definitive Edition, Vol. 1" }],
  );

  // the VIZBIG's volumes are all held by the Definitive: nothing to take
  await takeBack(shelf, id, VIZBIG, [1, 2, 3]);

  expect(await now(id)).toEqual({
    owned: 3,
    books: ["Vagabond Definitive Edition, Vol. 1"],
  });
});
