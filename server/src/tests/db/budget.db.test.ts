// The paid search budget, in the database: each SerpApi key gets so many
// searches a month and never one more, a key SerpApi says is spent stays
// spent, and every search is counted to whoever it was for
// (models/priceQueries.ts). No search is ever made here.
import priceQueries from "../../models/priceQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

const used = async (provider: string) =>
  (await prisma.apiUsage.findFirst({ where: { provider } }))?.calls ?? 0;

test("a key gets its monthly searches and not one more", async () => {
  const claims = [];
  for (let i = 0; i < 5; i++)
    claims.push(await priceQueries.claimApiCall("serpapi-test", 3));
  expect(claims).toEqual([true, true, true, false, false]);
  expect(await used("serpapi-test")).toBe(3);
});

test("claims made at the same moment still stop at the limit", async () => {
  const claims = await Promise.all(
    Array.from({ length: 10 }, () =>
      priceQueries.claimApiCall("serpapi-race", 4),
    ),
  );
  expect(claims.filter(Boolean)).toHaveLength(4);
  expect(await used("serpapi-race")).toBe(4);
});

test("each key has its own allowance", async () => {
  expect(await priceQueries.claimApiCall("serpapi-a", 1)).toBe(true);
  expect(await priceQueries.claimApiCall("serpapi-a", 1)).toBe(false);
  expect(await priceQueries.claimApiCall("serpapi-b", 1)).toBe(true);
});

test("a key SerpApi says is out stays out, whatever our count said", async () => {
  await priceQueries.claimApiCall("serpapi-out", 250);
  await priceQueries.markApiSpent("serpapi-out", 250);
  expect(await used("serpapi-out")).toBe(250);
  expect(await priceQueries.claimApiCall("serpapi-out", 250)).toBe(false);
});

test("searches are counted to the signed-in user, or to the visitor", async () => {
  const user = await prisma.user.create({
    data: { username: "reader", password: "x" },
  });
  await priceQueries.recordSearch({ userId: user.id });
  await priceQueries.recordSearch({ userId: user.id });
  const visitor = { visitor: "abcdef0123456789", userAgent: "Browser/1" };
  await priceQueries.recordSearch(visitor);
  await priceQueries.recordSearch(visitor);
  await priceQueries.recordSearch({ ...visitor, userAgent: "Browser/2" });

  const saved = await prisma.user.findUnique({ where: { id: user.id } });
  expect(saved?.serpapiSearches).toBe(2);
  const guests = await prisma.guestSearch.findMany();
  expect(guests).toHaveLength(1);
  // the browser they last said they were
  expect(guests[0]).toMatchObject({ searches: 3, userAgent: "Browser/2" });
  // an account deleted mid-search is no error
  await expect(
    priceQueries.recordSearch({ userId: 999999 }),
  ).resolves.toBeUndefined();
});
