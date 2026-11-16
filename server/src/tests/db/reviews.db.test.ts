// Writing and reading readers' reviews, over the real routes and a real
// database: only someone who owns or has read a volume can review it, one
// each, and anyone can read them. Flags and the site owner's decisions are
// in reviewFlags.db.test.ts (sign-ins are limited to 10 in 5 minutes, and
// writes to 60 a minute, so most reviews here are written straight through
// reviews/reviews.ts). Nothing leaves the machine.
import request from "supertest";
import { app } from "../../app.js";
import { slugify } from "../../prices/stores/match.js";
import {
  askAboutFinishedVolume,
  seriesReviews,
  attachNoBookReviews,
  deleteShelfReview,
  publicReviews,
  shelfReviews,
  writeReview,
  writeShelfReview,
} from "../../reviews/reviews.js";
import mangaQueries from "../../models/mangaQueries.js";
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
  // one rating is counted, and isn't a score yet
  expect(page).toMatchObject({ count: 1, average: null, mayWrite: "sign-in" });
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
  expect(page).toMatchObject({ count: 1, average: null });
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

test("the volume just finished is asked about for a few days", async () => {
  const id = await member("reader", { owned: [1, 2, 3, 4], readVolume: 2 });
  const manga = await prisma.manga.findFirstOrThrow({ where: { userId: id } });
  const asked = async (now?: Date) =>
    (await shelfReviews(id, manga.id, now)).justFinished?.volume ?? null;
  // reads up to this volume, as the page's counter does; true when the
  // page will ask about it. `every` is how rarely it may (0: every time)
  let readVolume = 2;
  const readUpTo = async (volume: number, every = 0) => {
    await mangaQueries.setReading(
      { id: manga.id, readVolume },
      { readVolume: volume },
    );
    const wentUp = volume > readVolume;
    readVolume = volume;
    return wentUp
      ? askAboutFinishedVolume(id, manga.id, new Date(), every)
      : false;
  };
  // nothing finished since the page started asking
  expect(await asked()).toBe(null);

  // reading on is finishing a volume: the one they've read up to is asked
  // about, not the ones they only own past it
  expect(await readUpTo(3)).toBe(true);
  expect(await asked()).toBe(3);
  const inFourDays = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  expect(await asked(inFourDays)).toBe(null);

  // rated: answered
  await writeReview(id, ISBN(3), good);
  expect(await asked()).toBe(null);
  // the page's stars stay on the last volume read, rated or not
  expect((await shelfReviews(id, manga.id)).latest?.volume).toBe(3);

  // the cross closes the question
  const at = () =>
    prisma.manga
      .findUniqueOrThrow({ where: { id: manga.id } })
      .then((m) => m.readVolumeAt);
  await mangaQueries.forgetFinishedVolume(manga.id);
  expect(await at()).toBe(null);
  // and so does going back a volume: that one isn't finished after all
  expect(await readUpTo(4)).toBe(true);
  expect(await asked()).toBe(4);
  await readUpTo(3);
  expect(await at()).toBe(null);
  expect(await asked()).toBe(null);

  // reading past the end of our list: that volume can be rated all the
  // same, with no book to its name
  expect(await readUpTo(9)).toBe(true);
  const pastTheEnd = await shelfReviews(id, manga.id);
  expect(pastTheEnd.latest).toEqual({ volume: 9, isbn13: null });
  expect(pastTheEnd.justFinished?.volume).toBe(9);

  // finishing the series is finishing its last volume
  await mangaQueries.setStatus(manga.id, true);
  expect(await askAboutFinishedVolume(id, manga.id, new Date(), 0)).toBe(true);
  expect(await asked()).toBe(9);
  // and undoing that ends the question: nothing is asked about a volume
  // further back in its place
  await mangaQueries.setStatus(manga.id, false);
  expect(await at()).toBe(null);
  expect(await asked()).toBe(null);
});

test("a volume we have no book for is reviewed by its number, and joins its book later", async () => {
  // the series we know stops at vol. 7; they've read up to vol. 9
  const id = await member("ahead", { owned: [1], readVolume: 9 });
  const manga = await prisma.manga.findFirstOrThrow({ where: { userId: id } });
  const theirs = async () => {
    const shelf = await shelfReviews(id, manga.id);
    return shelf.written.map((one) => [
      one.volume,
      one.isbn13,
      one.review.rating,
    ]);
  };

  await writeShelfReview(id, manga.id, 9, good);
  expect(await theirs()).toEqual([[9, null, 4]]);
  // written over, not written twice
  await writeShelfReview(id, manga.id, 9, { ...good, rating: 2 });
  expect(await theirs()).toEqual([[9, null, 2]]);
  // a volume we do have a book for is that book's, as from its price page
  await writeShelfReview(id, manga.id, 3, good);
  expect(await theirs()).toEqual([
    [9, null, 2],
    [3, ISBN(3), 4],
  ]);
  expect((await read(null, 3)).body.reviews).toHaveLength(1);
  // one they haven't read is refused
  await expect(writeShelfReview(id, manga.id, 12, good)).rejects.toThrow(
    "owned or read",
  );

  // a book for vol. 9 turns up: the review is that book's, and on its page
  const slug = slugify(SERIES);
  await attachNoBookReviews(slug, new Map([[9, "9781999996009"]]));
  const onItsPage = await publicReviews("9781999996009");
  expect(onItsPage.count).toBe(1);
  expect(onItsPage.shown.map((review) => review.text)).toEqual([good.text]);

  // and it can be taken away by its number
  await deleteShelfReview(id, manga.id, 3);
  expect(await prisma.volumeReview.count({ where: { userId: id } })).toBe(1);
});

test("the question comes once in a blue moon", async () => {
  const id = await member("reader", { owned: [], readVolume: 1 });
  const manga = await prisma.manga.findFirstOrThrow({ where: { userId: id } });
  const day = 24 * 60 * 60 * 1000;
  // from the real clock: the reading saved below is stamped with the real
  // time, so a fixed start date would drift away from it
  const start = new Date();
  const later = (days: number) => new Date(start.getTime() + days * day);
  let readVolume = 1;
  // finishes the next volume on this day; true when the page will ask
  const finishNext = async (now: Date) => {
    await mangaQueries.setReading(
      { id: manga.id, readVolume },
      { readVolume: readVolume + 1 },
    );
    readVolume += 1;
    return askAboutFinishedVolume(id, manga.id, now, 30);
  };

  const askedAbout = async (now: Date) =>
    (await shelfReviews(id, manga.id, now)).justFinished?.volume ?? null;

  // the first volume they finish is asked about
  expect(await finishNext(start)).toBe(true);
  expect(await askedAbout(start)).toBe(2);
  // the next day's isn't a new question. The one already out, in its few
  // days, follows them to the volume they're on now
  expect(await finishNext(later(1))).toBe(false);
  expect(await askedAbout(later(1))).toBe(3);
  expect(await askedAbout(later(5))).toBe(null);
  // nor is one near the end of the month
  expect(await finishNext(later(29))).toBe(false);
  expect(await askedAbout(later(29))).toBe(null);
  // a month on, it's asked again
  expect(await finishNext(later(30))).toBe(true);
  expect(await askedAbout(later(30))).toBe(5);
  const reader = await prisma.user.findUniqueOrThrow({ where: { id } });
  expect(reader.rateAskedAt).toEqual(later(30));
});

test("stars with no words are never held back", async () => {
  const stars = { rating: 4, text: "", spoiler: false };
  // seven volumes, one tap each: more than the hour allows in words
  const tapper = await member("tapper", { owned: [1, 2, 3, 4, 5, 6, 7] });
  for (const n of [1, 2, 3, 4, 5, 6, 7])
    await writeReview(tapper, ISBN(n), stars);
  // and those taps don't use up the words: one still goes through
  await writeReview(tapper, ISBN(1), good);

  // a reader who has used up their words can still give stars
  const keen = await member("wordy", { owned: [1, 2, 3, 4, 5, 6, 7] });
  for (const n of [1, 2, 3, 4, 5, 6]) await writeReview(keen, ISBN(n), good);
  await writeReview(keen, ISBN(7), stars);
  await expect(writeReview(keen, ISBN(7), good)).rejects.toThrow("an hour");
});

test("a rating alone counts toward the average but isn't listed as a review", async () => {
  await writeReview(await member("first", { owned: [1] }), ISBN(1), good);
  await writeReview(await member("second", { owned: [1] }), ISBN(1), {
    rating: 5,
    text: "",
    spoiler: true,
  });
  let page = (await read(null, 1)).body;
  // counted, and not a score until five readers have rated
  expect(page).toMatchObject({ count: 2, average: null });
  expect(page.reviews).toHaveLength(1);
  for (const name of ["third", "fourth", "fifth"])
    await writeReview(await member(name, { owned: [1] }), ISBN(1), {
      rating: 5,
      text: "",
      spoiler: false,
    });
  page = (await read(null, 1)).body;
  expect(page).toMatchObject({ count: 5, average: 4.8 });
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
  // what the series page gets (prices/seriesService.ts)
  const ratings = await seriesReviews(slugify(SERIES));
  // counted volume by volume; nothing has the five ratings a score needs
  expect(ratings).toMatchObject({ count: 3, average: null });
  expect(ratings.volumes).toEqual([
    { isbn13: ISBN(1), volume: 1, count: 2, average: null, written: 1 },
    { isbn13: ISBN(2), volume: 2, count: 1, average: null, written: 1 },
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
  expect(open).toMatchObject({ count: 2, average: null });
  expect(open.shown.map((review) => review.text)).toEqual([good.text]);
});

test("a series on your shelf: what to rate next, and what you've written", async () => {
  // owns vols. 1 to 5, has read up to vol. 2
  const id = await member("reader", { owned: [1, 2, 3, 4, 5], readVolume: 2 });
  const manga = await prisma.manga.findFirstOrThrow({ where: { userId: id } });
  const numbers = (volumes: { volume: number }[]) =>
    volumes.map((volume) => volume.volume);
  // the ones read come first, latest first; then the ones owned past that
  let shelf = await shelfReviews(id, manga.id);
  expect(numbers(shelf.toRate)).toEqual([2, 1, 5, 4, 3]);
  expect(shelf.written).toEqual([]);
  // the page's stars are about the last one read, not the last one owned
  expect(shelf.latest?.volume).toBe(2);

  await writeReview(id, ISBN(2), good);
  await writeReview(id, ISBN(5), { rating: 3, text: "", spoiler: false });
  shelf = await shelfReviews(id, manga.id);
  expect(numbers(shelf.toRate)).toEqual([1, 4, 3]);
  // still the last one read, now that it's rated
  expect(shelf.latest?.volume).toBe(2);
  // theirs, latest volume first, each as the page shows a review
  expect(numbers(shelf.written)).toEqual([5, 2]);
  expect(shelf.written[1]).toMatchObject({
    isbn13: ISBN(2),
    review: { rating: 4, text: good.text, yours: true },
  });

  // someone else's series is nobody's to ask about
  const other = await member("other", { owned: [1] });
  expect(await shelfReviews(other, manga.id)).toEqual({
    latest: null,
    toRate: [],
    written: [],
    justFinished: null,
  });
  // and it needs a sign-in over the route
  await request(app)
    .get("/api/reviews/shelf")
    .query({ manga: manga.id })
    .expect(401);
});

test("deleting an account takes its reviews with it", async () => {
  const writer = await member("writer", { owned: [1] });
  await writeReview(writer, ISBN(1), good);
  await prisma.user.delete({ where: { id: writer } });
  expect(await prisma.volumeReview.count()).toBe(0);
});
