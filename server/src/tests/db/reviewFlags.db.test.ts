// Other readers' flags on a review, and the site owner's decisions, with a
// real database: two readers make a review a spoiler, three reports hide it,
// and only the owner (ADMIN_USERNAME) sees the reported ones or decides.
import request from "supertest";
import { app } from "../../app.js";
import config from "../../config/config.js";
import { flagReview, writeReview } from "../../reviews/reviews.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";
import {
  cleanReviewSeries,
  good,
  ISBN,
  member,
  saveReviewSeries,
  signedIn,
} from "./reviewHelpers.js";

const savedOwner = config.ADMIN_USERNAME;
beforeEach(async () => {
  await emptyDb();
  await cleanReviewSeries();
  await saveReviewSeries();
  config.ADMIN_USERNAME = "theowner";
});
afterAll(async () => {
  await cleanReviewSeries();
  config.ADMIN_USERNAME = savedOwner;
  await closeDb();
});

const page = async (n: number) =>
  (
    await request(app)
      .get(`/api/reviews/volume/${ISBN(n)}`)
      .expect(200)
  ).body;

test("a spoiler: said by the writer, or by two other readers", async () => {
  const writer = await member("writer", { owned: [1, 2] });
  const told = await writeReview(writer, ISBN(1), { ...good, spoiler: true });
  expect(told.spoiler).toBe(true);

  const plain = await writeReview(writer, ISBN(2), good);
  const flagOverTheRoute = (agent: ReturnType<typeof request.agent>) =>
    agent.post(`/api/reviews/${plain.id}/flag`).send({ kind: "spoiler" });
  // not your own, and not signed out
  await flagOverTheRoute(await signedIn("writer")).expect(400);
  await flagOverTheRoute(request.agent(app)).expect(401);
  await member("flagone", null);
  const one = await signedIn("flagone");
  await flagOverTheRoute(one).expect(204);
  // the same reader twice is still one
  await flagOverTheRoute(one).expect(204);
  expect((await page(2)).reviews[0].spoiler).toBe(false);
  await flagReview(plain.id, await member("flagtwo", null), "spoiler");
  expect((await page(2)).reviews[0].spoiler).toBe(true);
  // a flag has to be one of the two kinds
  await one
    .post(`/api/reviews/${plain.id}/flag`)
    .send({ kind: "boring" })
    .expect(400);
});

test("three reports hide a review until the site's owner keeps or removes it", async () => {
  const writerId = await member("writer", { owned: [1] });
  const { id } = await writeReview(writerId, ISBN(1), good);
  for (const name of ["reportone", "reporttwo", "reportthree"]) {
    expect((await page(1)).reviews).toHaveLength(1);
    await flagReview(id, await member(name, null), "report");
  }
  // gone for everyone but its writer, who is told
  expect(await page(1)).toMatchObject({ count: 0, reviews: [] });
  const writer = await signedIn("writer");
  const theirs = await writer.get(`/api/reviews/volume/${ISBN(1)}`);
  expect(theirs.body.yours).toMatchObject({ hidden: true });
  // and it can't be flagged again while it's hidden
  await expect(
    flagReview(id, await member("late", null), "report"),
  ).rejects.toThrow("gone");

  // only the owner sees the list or decides
  await writer.get("/api/reviews/reported").expect(404);
  await writer
    .post(`/api/reviews/${id}/decide`)
    .send({ keep: true })
    .expect(404);
  await request(app).get("/api/reviews/reported").expect(404);
  await member("theowner", null);
  const owner = await signedIn("theowner");
  const list = (await owner.get("/api/reviews/reported").expect(200)).body;
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ id, reports: 3, hidden: true });

  // kept: it shows again, with a clean slate
  await owner
    .post(`/api/reviews/${id}/decide`)
    .send({ keep: true })
    .expect(204);
  expect((await page(1)).reviews).toHaveLength(1);
  expect((await owner.get("/api/reviews/reported")).body).toEqual([]);
  // removed: gone for good
  await owner
    .post(`/api/reviews/${id}/decide`)
    .send({ keep: false })
    .expect(204);
  expect(await prisma.volumeReview.count()).toBe(0);
  await owner
    .post(`/api/reviews/${id}/decide`)
    .send({ keep: true })
    .expect(404);
});
