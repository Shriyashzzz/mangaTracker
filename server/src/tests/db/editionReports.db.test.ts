// Readers reporting an omnibus or deluxe book no catalog lists
// (util/shelf/editionReports.ts), on a real database: it counts once three
// readers agree, or once the owner approves; never after a rejection
import request from "supertest";
import { app } from "../../app.js";
import userQueries from "../../models/userQueries.js";
import { volumesKey } from "../../prices/volumesKey.js";
import type { EditionLine } from "../../prices/editionLines.js";
import {
  countedBooks,
  decideBook,
  reportBook,
  withCountedBooks,
} from "../../util/shelf/editionReports.js";
import { closeDb, prisma } from "./testDb.js";

const SERIES = "Zzedition Report Series";
const KEY = volumesKey(SERIES);
// a minute on, past what's kept in memory
const later = () => Date.now() + 61_000;

const line: EditionLine = {
  key: "omnibus",
  kind: "omnibus",
  label: "Omnibus",
  books: [
    {
      number: 1,
      volumes: [1, 2, 3],
      isbn13: "9781999990001",
      title: null,
      listed: true,
    },
    { number: 2, volumes: [4, 5, 6], isbn13: null, title: null, listed: false },
  ],
};

const clean = async () => {
  await prisma.editionReport.deleteMany({ where: { series: KEY } });
  await prisma.editionDecision.deleteMany({ where: { series: KEY } });
  await prisma.user.deleteMany({
    where: { username: { startsWith: "zzreader" } },
  });
};
beforeEach(clean);
afterAll(async () => {
  await clean();
  await closeDb();
});

const readers = async (count: number) => {
  const ids: number[] = [];
  for (let i = 1; i <= count; i++)
    ids.push((await userQueries.addUser(`zzreader${i}`, "a good password"))!);
  return ids;
};
const omnibus3 = {
  name: SERIES,
  edition: "omnibus",
  number: 3,
  volumes: [7, 8, 9],
};
const bookOf = async (number: number) =>
  withCountedBooks(await countedBooks(later()), SERIES, [line])[0]!.books.find(
    (b) => b.number === number,
  );

test("a book counts once three readers agree on what it holds", async () => {
  const [a, b, c] = await readers(3);
  await reportBook(a!, omnibus3);
  await reportBook(b!, omnibus3);
  expect(await bookOf(3)).toBeUndefined();
  await reportBook(c!, omnibus3);
  expect(await bookOf(3)).toMatchObject({
    volumes: [7, 8, 9],
    sure: true,
    listed: false,
  });
});

test("readers who disagree on the volumes don't add up", async () => {
  const [a, b, c] = await readers(3);
  await reportBook(a!, omnibus3);
  await reportBook(b!, omnibus3);
  await reportBook(c!, { ...omnibus3, volumes: [7, 8] });
  expect(await bookOf(3)).toBeUndefined();
});

test("a reader reporting twice is one reader", async () => {
  const [a, b] = await readers(2);
  await reportBook(a!, omnibus3);
  await reportBook(a!, omnibus3);
  await reportBook(b!, omnibus3);
  expect(await prisma.editionReport.count({ where: { series: KEY } })).toBe(2);
  expect(await bookOf(3)).toBeUndefined();
});

test("the owner's approval counts at once; a rejection keeps it out", async () => {
  const [a, b, c] = await readers(3);
  await reportBook(a!, omnibus3);
  await decideBook(KEY, "omnibus", 3, "approved", [7, 8, 9]);
  expect(await bookOf(3)).toMatchObject({ sure: true });
  // a worked-out book the line has already is vouched for, not added twice
  await decideBook(KEY, "omnibus", 2, "approved", [4, 5, 6]);
  const books = withCountedBooks(await countedBooks(later()), SERIES, [
    line,
  ])[0]!.books;
  expect(books.filter((x) => x.number === 2)).toHaveLength(1);
  expect(books.find((x) => x.number === 2)).toMatchObject({ sure: true });
  // rejected: however many readers agree, it never counts
  await decideBook(KEY, "omnibus", 3, "rejected", [7, 8, 9]);
  await reportBook(b!, omnibus3);
  await reportBook(c!, omnibus3);
  expect(await bookOf(3)).toBeUndefined();
});

test("reporting needs an account, and the review is the owner's only", async () => {
  expect(
    (await request(app).post("/api/editions/reports").send(omnibus3)).status,
  ).toBe(401);
  await readers(1);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "zzreader1", password: "a good password" })
    .expect(200);
  expect((await agent.get("/api/editions/reports")).status).toBe(404);
  // a series with no saved edition lines: nothing to report on
  expect(
    (await agent.post("/api/editions/reports").send(omnibus3)).status,
  ).toBe(404);
});
