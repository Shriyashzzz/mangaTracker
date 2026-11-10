// Saved release answers (util/releases/releaseAnswers.ts) with a real
// database: what's kept, what's handed back, what stops matching, and that a
// shelf's answers are its owner's alone. Nothing leaves this machine.
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import {
  ANSWER_FRESH_MS,
  saveAnswer,
  savedAnswers,
} from "../../util/releases/releaseAnswers.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

beforeEach(async () => {
  await emptyDb();
});
afterAll(async () => {
  await closeDb();
});

const news = {
  releaseStatus: { hasNewVolume: true, nextVolume: 4 },
  complete: true,
  outcome: "news",
};

const reader = async (username: string) => {
  const userId = (await userQueries.addUser(username, "a good password"))!;
  const manga = await prisma.manga.create({
    data: { userId, name: "Zzanswer Series", volumesOwned: 3 },
  });
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: "a good password" })
    .expect(200);
  return { userId, manga, agent };
};

test("a whole answer is kept and handed back, without the full dates", async () => {
  const { manga } = await reader("answers1");
  await saveAnswer(manga, null, { ...news, releaseData: { big: 1 } } as never);
  const saved = await savedAnswers([manga], null);
  expect(saved[manga.id]).toMatchObject(news);
  expect(saved[manga.id]).not.toHaveProperty("releaseData");
  expect(typeof saved[manga.id]!.checkedAt).toBe("string");
});

test("failed, partial and switched-off answers aren't kept", async () => {
  const { manga } = await reader("answers2");
  await saveAnswer(manga, null, { ...news, outcome: "failed" });
  await saveAnswer(manga, null, { ...news, complete: false });
  await saveAnswer(manga, null, { ...news, outcome: "off" });
  expect(await prisma.releaseAnswer.count()).toBe(0);
  // not found is an answer worth keeping
  await saveAnswer(manga, null, {
    releaseStatus: null,
    complete: true,
    outcome: "notFound",
  });
  expect((await savedAnswers([manga], null))[manga.id]?.outcome).toBe(
    "notFound",
  );
});

test("an answer stops counting once what it depended on changes", async () => {
  const { manga } = await reader("answers3");
  await saveAnswer(manga, null, news);
  const changed = [
    { ...manga, volumesOwned: 4 },
    { ...manga, bookmark: 30 },
    { ...manga, name: "Zzanswer Series Renamed" },
    { ...manga, seenVolume: 4 },
    { ...manga, hiddenVolumes: [4] },
    { ...manga, lightNovel: true },
  ];
  for (const m of changed)
    expect((await savedAnswers([m], null))[m.id]).toBeUndefined();
  // and when their release settings change
  expect(
    (await savedAnswers([manga], { releases: { volumes: "all" } }))[manga.id],
  ).toBeUndefined();
  // unchanged, it still counts
  expect((await savedAnswers([manga], null))[manga.id]).toBeDefined();
});

test("an answer older than the sources it came from isn't handed back", async () => {
  const { manga } = await reader("answers4");
  await saveAnswer(manga, null, news);
  await prisma.releaseAnswer.update({
    where: { mangaId: manga.id },
    data: { checkedAt: new Date(Date.now() - ANSWER_FRESH_MS - 1000) },
  });
  expect((await savedAnswers([manga], null))[manga.id]).toBeUndefined();
});

test("a new answer replaces the old one", async () => {
  const { manga } = await reader("answers5");
  await saveAnswer(manga, null, news);
  await saveAnswer(manga, null, {
    ...news,
    releaseStatus: { hasNewVolume: false },
  });
  expect(await prisma.releaseAnswer.count()).toBe(1);
  expect((await savedAnswers([manga], null))[manga.id]?.releaseStatus).toEqual({
    hasNewVolume: false,
  });
});

test("deleting the manga takes its answer with it", async () => {
  const { manga } = await reader("answers6");
  await saveAnswer(manga, null, news);
  await prisma.manga.delete({ where: { id: manga.id } });
  expect(await prisma.releaseAnswer.count()).toBe(0);
});

test("the route hands back only the reader's own shelf", async () => {
  const one = await reader("answers7");
  const two = await reader("answers8");
  await saveAnswer(one.manga, null, news);
  await saveAnswer(two.manga, null, news);
  const res = await one.agent.get("/api/manga/releases/saved").expect(200);
  expect(Object.keys(res.body.answers)).toEqual([String(one.manga.id)]);
  // and their settings, so a browser can tell they changed elsewhere
  expect(typeof res.body.settings).toBe("string");
  expect((await request(app).get("/api/manga/releases/saved")).status).toBe(
    401,
  );
});

test("with release checks off, the route hands back nothing", async () => {
  const { userId, manga, agent } = await reader("answers9");
  await saveAnswer(manga, null, news);
  await prisma.user.update({
    where: { id: userId },
    data: { prefs: { releaseChecks: "off" } },
  });
  const res = await agent.get("/api/manga/releases/saved").expect(200);
  expect(res.body.answers).toEqual({});
});
