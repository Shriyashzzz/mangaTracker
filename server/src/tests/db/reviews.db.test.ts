// Writing and reading readers' reviews, over the real routes and a real
// database: only someone who owns or has read a volume can review it, one
// each, and anyone can read them. Flags and the site owner's decisions are
// in reviewFlags.db.test.ts (sign-ins are limited to 10 in 5 minutes, and
// writes to 10 a minute, so most reviews here are written straight through
// reviews/reviews.ts). Nothing leaves the machine.
import request from "supertest";
import { app } from "../../app.js";
import { slugify } from "../../prices/stores/match.js";
import {
  publicReviews,
  volumesToRate,
  writeReview,
} from "../../reviews/reviews.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";
import {
  cleanReviewSeries,
  good,
  ISBN,
  member,
  saveReviewSeries,
  SERIES,
  signedIn,
} from "./reviewHelpers.js";

beforeEach(async () => {
  await emptyDb();
  await cleanReviewSeries();
  await saveReviewSeries();
});
afterAll(async () => {
  await cleanReviewSeries();
  await closeDb();
});

type Agent = ReturnType<typeof request.agent>;
const write = (agent: Agent, n: number, body: object) =>
  agent.put(`/api/reviews/volume/${ISBN(n)}`).send(body);
const read = (agent: Agent | null, n: number) =>
  (agent ?? request(app)).get(`/api/reviews/volume/${ISBN(n)}`);

test("someone who owns a volume reviews it, and anyone can read it", async () => {
  await member("writer", { owned: [1, 2] });
  const writer = await signedIn("writer");
  expect((await read(writer, 1)).body).toMatchObject({
    count: 0,
    average: null,
    reviews: [],
    yours: null,
    mayWrite: "yes",
  });
  const saved = await write(writer, 1, good).expect(200);
  expect(saved.body).toMatchObject({ rating: 4, yours: true, spoiler: false });

  // signed out: the review, under a name that isn't their username
  const page = (await read(null, 1).expect(200)).body;
  expect(page).toMatchObject({ count: 1, average: 4, mayWrite: "sign-in" });
  expect(page.reviews).toHaveLength(1);
  expect(page.reviews[0]).toMatchObject({
    rating: 4,
    text: good.text,
    yours: false,
  });
  expect(page.reviews[0].by).toBeTruthy();
  expect(JSON.stringify(page)).not.toContain("writer");
  // kept under the series, with the volume's number
  const [row] = await prisma.volumeReview.findMany();
  expect(row).toMatchObject({ seriesSlug: slugify(SERIES), volume: 1 });
});

test("a volume not owned or read can't be reviewed, nor one by nobody signed in", async () => {
  await member("ownstwo", { owned: [1, 2] });
  const ownsTwo = await signedIn("ownstwo");
  expect((await read(ownsTwo, 3)).body.mayWrite).toBe("not-read");
  await write(ownsTwo, 3, good).expect(403);
  // the series isn't on their shelf at all
  await member("stranger", null);
  await write(await signedIn("stranger"), 1, good).expect(403);
  await request(app)
    .put(`/api/reviews/volume/${ISBN(1)}`)
    .send(good)
    .expect(401);
  expect(await prisma.volumeReview.count()).toBe(0);
});

test("having read up to a volume, or finished the series, counts as read", async () => {
  const borrower = await member("borrower", { readVolume: 2 });
  await writeReview(borrower, ISBN(2), good);
  await expect(writeReview(borrower, ISBN(3), good)).rejects.toThrow(
    "owned or read",
  );
  await prisma.manga.updateMany({
    where: { userId: borrower },
    data: { status: true },
  });
  await writeReview(borrower, ISBN(3), good);
  expect(await prisma.volumeReview.count()).toBe(2);
});

test("one review each: writing again changes it, and it can be taken back", async () => {
  const id = await member("writer", { owned: [1] });
  const writer = await signedIn("writer");
  await writeReview(id, ISBN(1), good);
  await writeReview(id, ISBN(1), {
    rating: 2,
    text: "On a second read, no.",
    spoiler: false,
  });
  const page = (await read(writer, 1)).body;
  expect(page).toMatchObject({ count: 1, average: 2 });
  expect(page.yours).toMatchObject({
    rating: 2,
    text: "On a second read, no.",
  });
  await writer.delete(`/api/reviews/volume/${ISBN(1)}`).expect(204);
  expect((await read(writer, 1)).body).toMatchObject({ count: 0, yours: null });
});

test("what a review can't be: unrated, too long, or carrying a link", async () => {
  await member("writer", { owned: [1] });
  const writer = await signedIn("writer");
  await write(writer, 1, { text: "no stars" }).expect(400);
  await write(writer, 1, { rating: 6, text: "six" }).expect(400);
  await write(writer, 1, { rating: 4, text: "x".repeat(501) }).expect(400);
  const spam = await write(writer, 1, {
    rating: 5,
    text: "cheap copies at www.spam-books.example",
  }).expect(400);
  expect(JSON.stringify(spam.body)).toContain("links");
  expect(await prisma.volumeReview.count()).toBe(0);
});

test("a reader can only write so many in an hour", async () => {
  const id = await member("keen", { owned: [1, 2, 3, 4, 5, 6, 7] });
  for (const n of [1, 2, 3, 4, 5, 6]) await writeReview(id, ISBN(n), good);
  // a seventh volume within the hour is turned away
  await expect(writeReview(id, ISBN(7), good)).rejects.toThrow("an hour");
  // changing one already written is always allowed
  await writeReview(id, ISBN(1), { ...good, rating: 5 });
});

test("a rating alone counts toward the average but isn't listed as a review", async () => {
  await writeReview(await member("first", { owned: [1] }), ISBN(1), good);
  await writeReview(await member("second", { owned: [1] }), ISBN(1), {
    rating: 5,
    text: "",
    spoiler: true,
  });
  const page = (await read(null, 1)).body;
  expect(page).toMatchObject({ count: 2, average: 4.5 });
  expect(page.reviews).toHaveLength(1);
  // nothing to spoil with no words
  const [bare] = await prisma.volumeReview.findMany({ where: { body: "" } });
  expect(bare?.spoiler).toBe(false);
});

test("a series adds up its volumes' ratings", async () => {
  const writer = await member("writer", { owned: [1, 2] });
  const other = await member("other", { owned: [1] });
  await writeReview(writer, ISBN(1), good);
  await writeReview(other, ISBN(1), { rating: 5, text: "", spoiler: false });
  await writeReview(writer, ISBN(2), {
    rating: 2,
    text: "A step down.",
    spoiler: false,
  });
  const res = await request(app)
    .get("/api/reviews/series")
    .query({ name: SERIES })
    .expect(200);
  expect(res.body).toMatchObject({ count: 3, average: 3.7 });
  expect(res.body.volumes).toEqual([
    { isbn13: ISBN(1), volume: 1, count: 2, average: 4.5, written: 1 },
    { isbn13: ISBN(2), volume: 2, count: 1, average: 2, written: 1 },
  ]);
});

test("the page gets how the ratings spread, and search engines never get a spoiler", async () => {
  await writeReview(await member("first", { owned: [1] }), ISBN(1), good);
  await writeReview(await member("second", { owned: [1] }), ISBN(1), {
    rating: 5,
    text: "The twist on the last page is that he dies.",
    spoiler: true,
  });
  const page = (await read(null, 1)).body;
  expect(page.spread).toEqual([0, 0, 0, 1, 1]);
  // both are sent to the page (it inks the spoiler out)
  expect(page.reviews).toHaveLength(2);
  const open = await publicReviews(ISBN(1));
  expect(open).toMatchObject({ count: 2, average: 4.5 });
  expect(open.shown.map((review) => review.text)).toEqual([good.text]);
});

test("a series on your shelf asks about the latest volume read and not yet rated", async () => {
  const id = await member("reader", { owned: [1, 2, 3] });
  const manga = await prisma.manga.findFirstOrThrow({ where: { userId: id } });
  const ask = async () =>
    (await volumesToRate(id, manga.id)).map((volume) => volume.volume);
  expect(await ask()).toEqual([3, 2, 1]);
  await writeReview(id, ISBN(3), good);
  expect(await ask()).toEqual([2, 1]);
  // someone else's series is nobody's to ask about
  const other = await member("other", { owned: [1] });
  expect(await volumesToRate(other, manga.id)).toEqual([]);
  // and it needs a sign-in over the route
  await request(app)
    .get("/api/reviews/to-rate")
    .query({ manga: manga.id })
    .expect(401);
});

test("deleting an account takes its reviews with it", async () => {
  const writer = await member("writer", { owned: [1] });
  await writeReview(writer, ISBN(1), good);
  await prisma.user.delete({ where: { id: writer } });
  expect(await prisma.volumeReview.count()).toBe(0);
});
