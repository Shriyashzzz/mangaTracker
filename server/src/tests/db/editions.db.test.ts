// Editions under one series, through the real routes and a real database:
// the shelf says which entries are one series, a merge puts them under the
// series' own name with every book kept, and the shelf check finds a series
// by any of its editions' names. No catalog or store is called.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { findOnShelf } from "../../prices/service.js";
import { answeredVolumes } from "../../util/shelf/bookVolumeAnswers.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { sameSeriesGroups } from "../../../../client/src/lib/sameSeries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const PASSWORD = "a good password";

type Sent = {
  id: number;
  name: string;
  seriesKey: string;
  plainName: string | null;
  editionStamp: { label: string; short: string; more: number } | null;
  ownedList: number[];
  volumesOwned: number | null;
  planned: boolean;
  rating: number | null;
};

const signedIn = async (username = "collector") => {
  const userId = (await userQueries.addUser(username, PASSWORD))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: PASSWORD })
    .expect(200);
  return { agent, userId };
};

// the three ways one series ended up on a shelf: added by name, To read from
// a price page, and a scanned Definitive
const threeVagabonds = async (userId: number) => {
  const plain = await prisma.manga.create({
    data: { userId, name: "Vagabond", planned: true, rating: 5 },
  });
  const vizbig = await prisma.manga.create({
    data: { userId, name: "Vagabond VIZBIG Edition", planned: true },
  });
  const definitive = await prisma.manga.create({
    data: {
      userId,
      name: "Vagabond Definitive Edition",
      volumesOwned: 6,
      books: {
        create: [
          {
            edition: "deluxe",
            number: 1,
            title: "Vagabond Definitive Edition, Vol. 1",
            volumes: [1, 2, 3],
          },
          {
            edition: "deluxe",
            number: 2,
            title: "Vagabond Definitive Edition, Vol. 2",
            volumes: [4, 5, 6],
          },
        ],
      },
    },
  });
  return { plain, vizbig, definitive };
};

const shelfOf = async (agent: ReturnType<typeof request.agent>) =>
  ((await agent.get("/api/manga").expect(200)).body as { manga: Sent[] }).manga;

beforeEach(emptyDb);
afterAll(closeDb);

test("the shelf says which entries are one series, and stamps the edition", async () => {
  const { agent, userId } = await signedIn();
  await threeVagabonds(userId);
  await prisma.manga.create({ data: { userId, name: "Rave Master" } });
  const shelf = await shelfOf(agent);
  const byName = new Map(shelf.map((m) => [m.name, m]));

  const keys = [
    "Vagabond",
    "Vagabond VIZBIG Edition",
    "Vagabond Definitive Edition",
  ].map((name) => byName.get(name)!.seriesKey);
  expect(new Set(keys).size).toBe(1);
  expect(byName.get("Vagabond")!.plainName).toBe(null);
  expect(byName.get("Vagabond VIZBIG Edition")!.plainName).toBe("Vagabond");
  // a name that only ends like an edition is its own series
  expect(byName.get("Rave Master")!.seriesKey).not.toBe(keys[0]);
  expect(byName.get("Rave Master")!.plainName).toBe(null);

  // two Definitive books and nothing else: stamped, with nothing beside it
  expect(byName.get("Vagabond Definitive Edition")!.editionStamp).toEqual({
    label: "Definitive",
    short: "DEF",
    more: 0,
  });
  expect(byName.get("Vagabond")!.editionStamp).toBe(null);

  // and the page groups them into one offer, named for the series
  const groups = sameSeriesGroups(shelf);
  expect(groups.map((g) => [g.name, g.entries.length])).toEqual([
    ["Vagabond", 3],
  ]);
});

test("merging puts them under the series' name and keeps every book", async () => {
  const { agent, userId } = await signedIn();
  const { plain, vizbig, definitive } = await threeVagabonds(userId);
  await agent
    .post(`/api/manga/${plain.id}/merge`)
    .send({ otherIds: [vizbig.id, definitive.id] })
    .expect(204);

  const shelf = await shelfOf(agent);
  expect(shelf.map((m) => m.name)).toEqual(["Vagabond"]);
  const merged = shelf[0]!;
  expect(merged.id).toBe(plain.id);
  expect(merged.volumesOwned).toBe(6);
  // it owns volumes now: no longer only on To read
  expect(merged.planned).toBe(false);
  expect(merged.rating).toBe(5);
  expect(merged.editionStamp).toEqual({
    label: "Definitive",
    short: "DEF",
    more: 0,
  });
  const books = (await agent.get(`/api/manga/${plain.id}/books`).expect(200))
    .body.books as { label: string | null; volumes: number[] }[];
  expect(books.map((b) => [b.label, b.volumes])).toEqual([
    ["Definitive", [1, 2, 3]],
    ["Definitive", [4, 5, 6]],
  ]);
});

test("merged into an edition's entry, it still takes the series' own name", async () => {
  const { agent, userId } = await signedIn();
  const { vizbig, definitive } = await threeVagabonds(userId);
  // the plain "Vagabond" is left out: only the two editions
  await agent
    .post(`/api/manga/${definitive.id}/merge`)
    .send({ otherIds: [vizbig.id] })
    .expect(204);
  const names = (await shelfOf(agent)).map((m) => m.name).sort();
  expect(names).toEqual(["Vagabond", "Vagabond"]);
});

test("someone else's entry can't be merged in", async () => {
  const { agent, userId } = await signedIn();
  const { plain } = await threeVagabonds(userId);
  const other = await signedIn("someoneelse");
  const theirs = await prisma.manga.create({
    data: { userId: other.userId, name: "Vagabond VIZBIG Edition" },
  });
  await agent
    .post(`/api/manga/${plain.id}/merge`)
    .send({ otherIds: [theirs.id] })
    .expect(404);
  expect(await prisma.manga.count({ where: { userId: other.userId } })).toBe(1);
});

test("the shelf check finds a series by any edition's name, both ways", async () => {
  const shelf = [{ name: "Vagabond" }, { name: "Berserk Deluxe Edition" }];
  expect((await findOnShelf(shelf, "Vagabond VIZBIG Edition"))?.name).toBe(
    "Vagabond",
  );
  expect((await findOnShelf(shelf, "Vagabond Definitive Edition"))?.name).toBe(
    "Vagabond",
  );
  // an old entry still under an edition's name is found by the plain one
  expect((await findOnShelf(shelf, "Berserk"))?.name).toBe(
    "Berserk Deluxe Edition",
  );
  expect(await findOnShelf(shelf, "Vinland Saga")).toBe(null);
});

test("a name ending in a number still finds itself, and other names don't", async () => {
  const shelf = [{ name: "Kaiju No. 8" }, { name: "Rave Master" }];
  expect((await findOnShelf(shelf, "Kaiju No. 8"))?.name).toBe("Kaiju No. 8");
  expect((await findOnShelf(shelf, "Rave Master"))?.name).toBe("Rave Master");
  // "Master Edition" is an edition; "Rave" is not "Rave Master"
  expect(await findOnShelf(shelf, "Rave")).toBe(null);
  expect(await findOnShelf(shelf, "Master")).toBe(null);
});

test("a cover can be a book's own, by its ISBN, and nothing else of ours", async () => {
  const { agent, userId } = await signedIn();
  const { plain } = await threeVagabonds(userId);
  const save = (image: string) =>
    agent
      .put(`/api/manga/${plain.id}`)
      .send({ name: "Vagabond", status: false, planned: true, image });
  const own = await save("/api/prices/cover/9781974752584");
  expect(own.status).toBeLessThan(300);
  expect((await save("/api/auth/logout")).status).toBe(400);
  expect((await save("javascript:alert(1)")).status).toBe(400);
});

// ---------- "Which volumes are in this book?" ----------

test("a reader's answer is theirs at once, and everyone's once three agree", async () => {
  const isbn = "9781632368164";
  const readers = await Promise.all(
    ["one", "two", "three", "four"].map((name) => signedIn(`reader${name}`)),
  );
  const say = (i: number, volumes: number[]) =>
    readers[i]!.agent.post("/api/manga/book-volumes").send({
      isbn13: isbn,
      volumes,
    });

  await say(0, [2, 1]).expect(204);
  // theirs, in order; nobody else's yet
  expect(await answeredVolumes(isbn, readers[0]!.userId)).toEqual([1, 2]);
  expect(await answeredVolumes(isbn, readers[3]!.userId)).toBe(null);
  expect(await answeredVolumes(isbn)).toBe(null);

  // a second reader agrees, a third says something else: still not shared
  await say(1, [1, 2]).expect(204);
  await say(2, [1, 2, 3]).expect(204);
  expect(await answeredVolumes(isbn)).toBe(null);
  // the third changes their mind: three agree, so it's everyone's
  await say(2, [1, 2]).expect(204);
  expect(await answeredVolumes(isbn)).toEqual([1, 2]);
  expect(await answeredVolumes(isbn, readers[3]!.userId)).toEqual([1, 2]);
  // their own answer still comes first for them
  await say(3, [5]).expect(204);
  expect(await answeredVolumes(isbn, readers[3]!.userId)).toEqual([5]);
  expect(await answeredVolumes(isbn)).toEqual([1, 2]);
});

test("an answer needs a real ISBN and whole volumes, and a signed-in reader", async () => {
  const { agent } = await signedIn();
  const send = (body: object) =>
    agent.post("/api/manga/book-volumes").send(body);
  expect((await send({ isbn13: "123", volumes: [1] })).status).toBe(400);
  expect((await send({ isbn13: "9781632368164", volumes: [] })).status).toBe(
    400,
  );
  expect((await send({ isbn13: "9781632368164", volumes: [1.5] })).status).toBe(
    400,
  );
  expect((await send({ isbn13: "9781632368164", volumes: [0] })).status).toBe(
    400,
  );
  const guest = await request(app)
    .post("/api/manga/book-volumes")
    .send({ isbn13: "9781632368164", volumes: [1] });
  expect(guest.status).toBe(401);
});

// ---------- a card's place in the edition they collect ----------
test("the shelf says where they are in the edition they collect", async () => {
  const { agent, userId } = await signedIn();
  const NAME = "Zzplace Edition Series";
  const key = `${volumesKey(NAME)}:editions`;
  const three = (book: number) => [book * 3 - 2, book * 3 - 1, book * 3];
  await prisma.seriesVolumes.deleteMany({ where: { key } });
  await prisma.seriesVolumes.create({
    data: {
      key,
      volumes: [
        {
          key: "vizbig",
          kind: "omnibus",
          label: "VIZBIG",
          books: Array.from({ length: 12 }, (_, i) => ({
            number: i + 1,
            volumes: three(i + 1),
            isbn13: null,
            title: null,
            listed: true,
          })),
        },
      ],
    },
  });
  try {
    await prisma.manga.create({
      data: {
        userId,
        name: NAME,
        edition: "vizbig",
        byVolume: true,
        readVolume: 12,
        volumesOwned: 12,
      },
    });
    await prisma.manga.create({
      data: { userId, name: "Zzplace Plain Series", readVolume: 3 },
    });
    type WithPlace = {
      name: string;
      editionPlace: { label: string; read: number; owned: number[] } | null;
    };
    const res = await agent.get("/api/manga").expect(200);
    const sent = res.body.manga as WithPlace[];
    expect(sent.find((m) => m.name === NAME)?.editionPlace).toEqual({
      label: "VIZBIG",
      read: 4,
      owned: [1, 2, 3, 4],
      next: 5,
      behind: 8,
      upTo: 4,
    });
    // single volumes: nothing to say
    expect(
      sent.find((m) => m.name === "Zzplace Plain Series")?.editionPlace,
    ).toBeNull();
  } finally {
    await prisma.seriesVolumes.deleteMany({ where: { key } });
  }
});
