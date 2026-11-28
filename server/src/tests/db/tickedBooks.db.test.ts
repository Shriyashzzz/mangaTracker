// A spine ticked while a series is collected in an edition is that edition's
// book, and stays so when the edition picked changes (util/shelf/
// tickedBooks.ts). Through the real routes and a real database; no catalog
// or store is called.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { editionsKey } from "../../prices/editionSource.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const PASSWORD = "a good password";
const NAME = "Vagabond";

// two editions of the one series, each three volumes to a book
const book = (label: string, number: number) => ({
  number,
  volumes: [number * 3 - 2, number * 3 - 1, number * 3],
  isbn13: null,
  title: `${NAME} ${label} Edition, Vol. ${number}`,
  listed: true,
});
const LINES = [
  {
    key: "vizbig",
    kind: "omnibus",
    label: "VIZBIG",
    books: [1, 2, 3].map((n) => book("VIZBIG", n)),
  },
  {
    key: "definitive",
    kind: "deluxe",
    label: "Definitive",
    books: [1, 2, 3].map((n) => book("Definitive", n)),
  },
];

type Listed = {
  edition: string;
  number: number;
  label: string | null;
  volumes: number[];
};

async function collecting(edition: string | null, lines = LINES) {
  const userId = (await userQueries.addUser("collector", PASSWORD))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "collector", password: PASSWORD })
    .expect(200);
  // (the saved lists outlive a test's clean-up: written over, not added)
  await prisma.seriesVolumes.upsert({
    where: { key: editionsKey(NAME) },
    create: { key: editionsKey(NAME), volumes: lines },
    update: { volumes: lines, fetchedAt: new Date() },
  });
  const manga = await prisma.manga.create({
    data: { userId, name: NAME, edition },
  });
  const own = (ownedList: number[]) =>
    agent
      .put(`/api/manga/${manga.id}/owned`)
      .send({ volumesOwned: null, ownedList })
      .expect(200);
  const books = async () =>
    (
      (await agent.get(`/api/manga/${manga.id}/books`).expect(200)).body
        .books as Listed[]
    ).map((b) => `${b.label} ${b.number}: ${b.volumes.join(",")}`);
  return { manga, own, books };
}

beforeEach(emptyDb);
afterAll(closeDb);

test("a book of the picked edition that a tick completes is recorded as that edition", async () => {
  const { own, books } = await collecting("definitive");
  // two of its three volumes: not a book yet
  await own([1, 2]);
  expect(await books()).toEqual([]);
  await own([1, 2, 3]);
  expect(await books()).toEqual(["Definitive 1: 1,2,3"]);
});

test("it stays that edition's book when another edition is picked", async () => {
  const { manga, own, books } = await collecting("definitive");
  await own([1, 2, 3]);
  await prisma.manga.update({
    where: { id: manga.id },
    data: { edition: "vizbig" },
  });
  // the next book, ticked as VIZBIG
  await own([1, 2, 3, 4, 5, 6]);
  expect((await books()).sort()).toEqual([
    "Definitive 1: 1,2,3",
    "VIZBIG 2: 4,5,6",
  ]);
});

test("volumes ticked before are never named, and a book isn't recorded twice", async () => {
  const { manga, own, books } = await collecting(null);
  // no edition picked: only volumes
  await own([1, 2, 3]);
  expect(await books()).toEqual([]);
  await prisma.manga.update({
    where: { id: manga.id },
    data: { edition: "vizbig" },
  });
  // saving the same again completes nothing new
  await own([1, 2, 3]);
  expect(await books()).toEqual([]);
  // unticked and ticked again under VIZBIG: one book, once
  await own([1, 2]);
  await own([1, 2, 3]);
  await own([1, 2, 3]);
  expect(await books()).toEqual(["VIZBIG 1: 1,2,3"]);
});

test("a book of the same edition comes back with its volumes, once", async () => {
  const { own, books } = await collecting("definitive");
  await own([1, 2, 3]);
  await own([1, 2]);
  expect(await books()).toEqual([]);
  await own([1, 2, 3]);
  expect(await books()).toEqual(["Definitive 1: 1,2,3"]);
});

test("ticked again as another edition, it's that edition's book", async () => {
  const { manga, own, books } = await collecting("vizbig");
  await own([1, 2, 3]);
  expect(await books()).toEqual(["VIZBIG 1: 1,2,3"]);
  // let go, then bought again as the Definitive
  await own([1, 2]);
  await prisma.manga.update({
    where: { id: manga.id },
    data: { edition: "definitive" },
  });
  await own([1, 2, 3]);
  expect(await books()).toEqual(["Definitive 1: 1,2,3"]);
});

test("collecting single volumes records nothing", async () => {
  const { own, books } = await collecting("singles");
  await own([1, 2, 3]);
  expect(await books()).toEqual([]);
});

test("a book still to come isn't recorded: ticking keeps their own book", async () => {
  // Definitive 3 is listed, but out a year from now
  const nextYear = new Date(Date.now() + 365 * 864e5)
    .toISOString()
    .slice(0, 10);
  const lines = LINES.map((line) =>
    line.key !== "definitive"
      ? line
      : {
          ...line,
          books: line.books.map((b) =>
            b.number === 3 ? { ...b, published: nextYear } : b,
          ),
        },
  );
  const { manga, own, books } = await collecting("vizbig", lines);
  await own([7, 8, 9]);
  expect(await books()).toEqual(["VIZBIG 3: 7,8,9"]);
  // seen as Definitive, unticked and ticked again: still their VIZBIG 3
  await prisma.manga.update({
    where: { id: manga.id },
    data: { edition: "definitive" },
  });
  await own([7, 8]);
  await own([7, 8, 9]);
  expect(await books()).toEqual(["VIZBIG 3: 7,8,9"]);
});
