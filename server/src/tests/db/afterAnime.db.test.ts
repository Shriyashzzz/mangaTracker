// "After the anime" over the real routes and a real database: a saved
// answer is served, a reader's fix is checked and kept for review, and only
// the site's owner can read or decide them. MangaUpdates and AniList are
// never called: every request here is a crawler's, which reads what's saved.
import request from "supertest";
import { app } from "../../app.js";
import config from "../../config/config.js";
import userQueries from "../../models/userQueries.js";
import { slugify } from "../../prices/stores/match.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

const SERIES = "Zzanime Test Series";
const slug = slugify(SERIES);
const CRAWLER = "mangatracker-preview/1.0";
const savedOwner = config.ADMIN_USERNAME;

const clean = async () => {
  await prisma.animeFix.deleteMany({ where: { slug } });
  await prisma.animeStops.deleteMany({ where: { slug } });
  await prisma.seriesInfo.deleteMany({ where: { slug } });
};

beforeEach(async () => {
  await emptyDb();
  await clean();
  config.ADMIN_USERNAME = "theowner";
  await prisma.seriesInfo.create({
    data: { slug, info: { name: SERIES, status: "RELEASING", volumes: null } },
  });
  await prisma.animeStops.create({
    data: {
      slug,
      name: SERIES,
      startLine: "Vol 1, Chap 1 (S1) / Vol 5, Chap 39 (S2)",
      endLine: "Vol 5, Chap 38 (S1) / Vol 12, Chap 97 (S2)",
      sourceUrl: "https://www.mangaupdates.com/series/test",
    },
  });
});
afterAll(async () => {
  await clean();
  config.ADMIN_USERNAME = savedOwner;
  await closeDb();
});

const signedIn = async (username: string) => {
  await userQueries.addUser(username, "a good password");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: "a good password" })
    .expect(200);
  return agent;
};
const fix = {
  name: SERIES,
  label: "Season 2",
  chapter: 99,
  volume: 13,
  source: "https://example.com/where-i-read-it",
};
// a reader's fix as the route keeps it. Put straight in the database: the
// route itself allows only a few a minute, and one test spends them
const keep = () =>
  prisma.animeFix.create({
    data: { slug, ...fix },
  });
const answer = () =>
  request(app)
    .get("/api/after-anime")
    .query({ name: SERIES })
    .set("User-Agent", CRAWLER);

test("a saved answer is served season by season", async () => {
  const res = await answer().expect(200);
  expect(res.body.name).toBe(SERIES);
  expect(
    res.body.stops.map((stop: { label: string; endChapter: number }) => [
      stop.label,
      stop.endChapter,
    ]),
  ).toEqual([
    ["Season 1", 38],
    ["Season 2", 97],
  ]);
  // Season 1 carries on in the volume Season 2 starts in
  expect(res.body.stops[0].nextVolume).toBe(5);
});

test("a series we've never seen is not found, for a crawler", async () => {
  await request(app)
    .get("/api/after-anime")
    .query({ name: "Zz No Such Series At All" })
    .set("User-Agent", CRAWLER)
    .expect(404);
});

test("a fix needs a season, a link, and a chapter or a volume", async () => {
  const send = (body: object) =>
    request(app).post("/api/after-anime/fix").send(body);
  // a good one is kept, waiting
  await send(fix).expect(201);
  const [kept] = await prisma.animeFix.findMany({ where: { slug } });
  expect(kept).toMatchObject({
    status: "pending",
    label: "Season 2",
    chapter: 99,
  });
  // (the route takes a few a minute: four are sent here)
  await send({ ...fix, label: "", source: "not a link" }).expect(400);
  await send({ ...fix, chapter: null, volume: null }).expect(400);
  await send({ ...fix, name: "Zz No Such Series At All" }).expect(404);
  expect(await prisma.animeFix.count({ where: { slug } })).toBe(1);
});

test("a fix is kept for review and changes nothing until it's accepted", async () => {
  await keep();
  const [kept] = await prisma.animeFix.findMany({ where: { slug } });
  expect(kept).toMatchObject({
    status: "pending",
    label: "Season 2",
    chapter: 99,
  });
  const before = await answer();
  expect(before.body.stops[1].endChapter).toBe(97);

  const owner = await signedIn("theowner");
  const waiting = await owner.get("/api/after-anime/fixes").expect(200);
  expect(JSON.stringify(waiting.body)).toContain("where-i-read-it");
  await owner
    .post(`/api/after-anime/fixes/${kept!.id}`)
    .send({ accept: true })
    .expect(200);
  const after = await answer();
  expect(after.body.stops[1]).toMatchObject({
    endChapter: 99,
    corrected: true,
  });
  // where the reader read it is for the owner's eyes, not the page's
  expect(JSON.stringify(after.body)).not.toContain("where-i-read-it");
});

test("only the site's owner reads or decides fixes: anyone else finds nothing there", async () => {
  await keep();
  const [kept] = await prisma.animeFix.findMany({ where: { slug } });
  const decide = (agent: ReturnType<typeof request.agent>) =>
    agent.post(`/api/after-anime/fixes/${kept!.id}`).send({ accept: true });

  // signed out
  await request(app).get("/api/after-anime/fixes").expect(404);
  await decide(request.agent(app)).expect(404);
  // signed in as someone else
  const reader = await signedIn("areader");
  await reader.get("/api/after-anime/fixes").expect(404);
  await decide(reader).expect(404);
  // no owner named at all: nobody is one
  config.ADMIN_USERNAME = undefined;
  const owner = await signedIn("theowner");
  await owner.get("/api/after-anime/fixes").expect(404);

  const [still] = await prisma.animeFix.findMany({ where: { slug } });
  expect(still?.status).toBe("pending");
});
