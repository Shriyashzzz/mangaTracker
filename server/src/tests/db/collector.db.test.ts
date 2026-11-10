// The shelf tools' routes (/api/collector) with a real database: what a shelf
// is worth, finishing a series, the release calendar, the deals, that each
// shelf is its owner's alone, and the off switch. Everything is seeded here:
// nothing leaves this machine.
import request from "supertest";
import { app } from "../../app.js";
import config from "../../config/config.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { volumesKey } from "../../prices/volumesKey.js";
import type { Offer } from "../../prices/types.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const SERIES = "Zzcollector Test Series";
const ISBN = (n: number) => `978199999000${n}`;
const KEYS = [volumesKey(SERIES), `${volumesKey(SERIES)}:google`];
const book = (n: number, published?: string) => ({
  isbn13: ISBN(n),
  title: `${SERIES}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
  ...(published && { published }),
});
const offer = (over: Partial<Offer>): Offer => ({
  store: "Kinokuniya",
  format: "print",
  condition: "new",
  priceCents: 1000,
  currency: "USD",
  inStock: true,
  url: "https://kinokuniya.example/book",
  ...over,
});

const clean = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: { in: KEYS } } });
  await prisma.book.deleteMany({
    where: { isbn13: { in: [1, 2, 3, 4].map(ISBN) } },
  });
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  // the catalog's list (vols 1 to 3) and Google's (adds vol 4, not out yet)
  await priceQueries.saveSeriesVolumes(KEYS[0]!, [book(1), book(2), book(3)]);
  const nextYear = new Date().getUTCFullYear() + 1;
  await priceQueries.saveSeriesVolumes(KEYS[1]!, [
    book(3),
    book(4, `${nextYear}-03-15`),
  ]);
  for (const n of [1, 2, 3])
    await prisma.book.create({
      data: { isbn13: ISBN(n), title: `${SERIES}, Vol. ${n}` },
    });
  // vol 1 (owned): used at $6; vol 2 (missing): new at $10.99
  await priceQueries.saveCheck(
    ISBN(1),
    ["ebay"],
    new Map([
      [
        "ebay",
        [
          offer({
            store: "eBay",
            condition: "used",
            priceCents: 600,
            url: "https://www.ebay.com/itm/1",
          }),
        ],
      ],
    ]),
  );
  await priceQueries.saveCheck(
    ISBN(2),
    ["serpapi"],
    new Map([["shopping", [offer({ priceCents: 1099 })]]]),
  );
});
afterAll(async () => {
  await clean();
  await closeDb();
});

const reader = async (username: string, owned: number | null) => {
  const userId = await userQueries.addUser(username, "a good password");
  if (owned !== null)
    await prisma.manga.create({
      data: { userId: userId!, name: SERIES, volumesOwned: owned },
    });
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: "a good password" })
    .expect(200);
  return agent;
};

test("signed out, a shelf's tools aren't there; the deals are", async () => {
  expect((await request(app).get("/api/collector/shelf")).status).toBe(401);
  expect((await request(app).get("/api/collector/calendar")).status).toBe(401);
  const deals = await request(app).get("/api/collector/deals");
  expect(deals.status).toBe(200);
  expect(Array.isArray(deals.body.deals)).toBe(true);
});

test("the shelf's worth, and what finishing the series costs", async () => {
  const agent = await reader("collector", 1);
  const res = await agent.get("/api/collector/shelf").expect(200);
  // owns vol 1: worth its used price
  expect(res.body.value).toMatchObject({ cents: 600, priced: 1, volumes: 1 });
  // missing vols 2 and 3 (4 isn't out yet): 2 priced, 3 estimated at the
  // series' usual new price
  const [row] = res.body.finish;
  expect(row.name).toBe(SERIES);
  expect(row.missing.map((m: { volume: number }) => m.volume)).toEqual([2, 3]);
  expect(row.missing[0].cheapest).toMatchObject({
    cents: 1099,
    store: "Kinokuniya",
  });
  expect(row).toMatchObject({ cents: 1099, priced: 1, estimateCents: 2198 });
  expect(res.body).toMatchObject({ finishCents: 1099, finishMissing: 2 });
});

test("the calendar lists the volume still to come", async () => {
  const agent = await reader("collector", 1);
  const res = await agent.get("/api/collector/calendar").expect(200);
  const volumes = res.body.months.flatMap(
    (m: { volumes: unknown[] }) => m.volumes,
  );
  expect(volumes).toEqual([
    expect.objectContaining({ volume: 4, name: SERIES, owned: false }),
  ]);
});

test("each reader sees their own shelf only", async () => {
  await reader("owner", 1);
  const other = await reader("someone", null);
  const res = await other.get("/api/collector/shelf").expect(200);
  expect(res.body.finish).toEqual([]);
  expect(res.body.value).toMatchObject({ cents: 0, volumes: 0 });
  const cal = await other.get("/api/collector/calendar").expect(200);
  expect(cal.body.months).toEqual([]);
});

test("COLLECTOR_TOOLS=off: none of it is there", async () => {
  const agent = await reader("collector", 1);
  const was = config.COLLECTOR_TOOLS;
  config.COLLECTOR_TOOLS = "off";
  try {
    expect((await agent.get("/api/collector/shelf")).status).toBe(404);
    expect((await request(app).get("/api/collector/deals")).status).toBe(404);
  } finally {
    config.COLLECTOR_TOOLS = was;
  }
});

test("a recorded price never goes stale: a later check finding nothing keeps it", async () => {
  const agent = await reader("collector", 1);
  // eBay looks again and finds no used copy of vol 1 now
  await priceQueries.saveCheck(ISBN(1), ["ebay"], new Map([["ebay", []]]));
  const res = await agent.get("/api/collector/shelf").expect(200);
  expect(res.body.value).toMatchObject({ cents: 600, priced: 1 });
});
