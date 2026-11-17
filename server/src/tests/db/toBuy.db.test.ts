// The To buy list, through the real routes and a real database: adding and
// taking off volumes, the list with its stored prices and totals, each
// reader's list their own, and the list going with a deleted account. No
// store or catalog is called: the books and prices are saved here.
import request from "supertest";
import { app } from "../../app.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const PASSWORD = "a good password";
const SERIES = "Zztobuy Test Series";
const ISBN = (n: number) => `978199999700${n}`;

const offer = (condition: string, priceCents: number, store: string) => ({
  store,
  format: "print",
  condition,
  priceCents,
  currency: "USD",
  inStock: true,
  url: null,
});

// a volume the site knows, with the prices a check found for it
const saveVolume = async (n: number, offers: ReturnType<typeof offer>[]) => {
  await priceQueries.upsertBook({
    isbn13: ISBN(n),
    title: `${SERIES}, Vol. ${n}`,
    authors: null,
    publisher: null,
    year: 2020,
    coverUrl: null,
  });
  if (offers.length)
    await priceQueries.saveCheck(
      ISBN(n),
      ["ebay"],
      new Map([["ebay", offers]]),
    );
};

const clean = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: volumesKey(SERIES) } });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [1, 2, 3].map(ISBN) } },
  });
};

const signedIn = async (username = "reader") => {
  await userQueries.addUser(username, PASSWORD);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: PASSWORD })
    .expect(200);
  return agent;
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  await saveVolume(1, [offer("new", 999, "eBay"), offer("used", 500, "eBay")]);
  await saveVolume(2, [offer("new", 1199, "eBay")]);
  await saveVolume(3, []);
});
afterAll(async () => {
  await clean();
  await closeDb();
});

test("the list is for signed-in readers", async () => {
  expect((await request(app).get("/api/to-buy")).status).toBe(401);
  expect((await request(app).put(`/api/to-buy/${ISBN(1)}`)).status).toBe(401);
});

test("added volumes are listed newest first, with their prices and totals", async () => {
  const agent = await signedIn();
  for (const n of [1, 2, 3])
    await agent.put(`/api/to-buy/${ISBN(n)}`).expect(200);
  // adding one twice keeps it once
  await agent.put(`/api/to-buy/${ISBN(1)}`).expect(200);

  const { body } = await agent.get("/api/to-buy").expect(200);
  expect(body.items.map((i: { isbn13: string }) => i.isbn13)).toEqual(
    [3, 2, 1].map(ISBN),
  );
  expect(body.items[2]).toMatchObject({
    title: `${SERIES}, Vol. 1`,
    series: SERIES,
    volume: 1,
    new: { cents: 999, store: "eBay" },
    used: { cents: 500, store: "eBay" },
  });
  // no price stored for volume 3: listed, and left out of the totals
  expect(body.items[0]).toMatchObject({ volume: 3, new: null, used: null });
  expect(body.totals).toEqual({
    volumes: 3,
    new: { cents: 2198, volumes: 2 },
    used: { cents: 500, volumes: 1 },
  });
});

test("a volume can be taken off, and an ISBN that isn't one is turned away", async () => {
  const agent = await signedIn();
  await agent.put(`/api/to-buy/${ISBN(1)}`).expect(200);
  await agent.delete(`/api/to-buy/${ISBN(1)}`).expect(200);
  // taking off one that isn't there is fine
  await agent.delete(`/api/to-buy/${ISBN(2)}`).expect(200);
  expect((await agent.get("/api/to-buy")).body.items).toEqual([]);
  expect((await agent.put("/api/to-buy/not-an-isbn")).status).toBe(400);
});

test("each reader has their own list, and it goes with their account", async () => {
  const one = await signedIn("readerone");
  const other = await signedIn("readertwo");
  await one.put(`/api/to-buy/${ISBN(1)}`).expect(200);
  expect((await other.get("/api/to-buy")).body.items).toEqual([]);

  const gone = await one.delete("/api/account").send({ password: PASSWORD });
  expect([gone.status, gone.body]).toEqual([204, {}]);
  expect(await prisma.toBuy.count()).toBe(0);
});

test("a volume that isn't out yet says when it is", async () => {
  // volume 3's release date, a year from today, as its series list has it
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const published = nextYear.toISOString().slice(0, 10);
  await priceQueries.saveSeriesVolumes(volumesKey(SERIES), [
    {
      isbn13: ISBN(3),
      title: `${SERIES}, Vol. 3`,
      authors: null,
      publisher: null,
      year: nextYear.getFullYear(),
      volume: 3,
      coverUrl: "",
      published,
    },
  ]);
  const agent = await signedIn();
  await agent.put(`/api/to-buy/${ISBN(3)}`).expect(200);
  await agent.put(`/api/to-buy/${ISBN(1)}`).expect(200);

  const { body } = await agent.get("/api/to-buy").expect(200);
  const [out, preorder] = body.items;
  expect(preorder).toMatchObject({ volume: 3, new: null, outOn: published });
  // one that's out and priced isn't a preorder
  expect(out).toMatchObject({ volume: 1, outOn: null });
});

test("clearing the list empties it, and only the reader's own", async () => {
  const one = await signedIn("readerone");
  const other = await signedIn("readertwo");
  for (const n of [1, 2]) await one.put(`/api/to-buy/${ISBN(n)}`).expect(200);
  await other.put(`/api/to-buy/${ISBN(3)}`).expect(200);

  expect((await request(app).delete("/api/to-buy")).status).toBe(401);
  await one.delete("/api/to-buy").expect(200);

  expect((await one.get("/api/to-buy")).body.items).toEqual([]);
  expect((await other.get("/api/to-buy")).body.items).toHaveLength(1);
});
