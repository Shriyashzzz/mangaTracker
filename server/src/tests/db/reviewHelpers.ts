// What the two review test files share: a seven-volume series the database
// knows, and readers with it on their shelf.
import request from "supertest";
import { app } from "../../app.js";
import priceQueries from "../../models/priceQueries.js";
import userQueries from "../../models/userQueries.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { prisma } from "./testDb.js";

export const SERIES = "Zzreview Test Series";
export const ISBN = (n: number) => `978199999600${n}`;
const book = (n: number) => ({
  isbn13: ISBN(n),
  title: `${SERIES}, Vol. ${n}`,
  authors: null,
  publisher: null,
  year: 2020,
  volume: n,
  coverUrl: "",
});
const VOLUMES = [1, 2, 3, 4, 5, 6, 7];
export const good = {
  rating: 4,
  text: "The art carries it. Slow middle.",
  spoiler: false,
};

export const saveReviewSeries = () =>
  priceQueries.saveSeriesVolumes(volumesKey(SERIES), VOLUMES.map(book));
export const cleanReviewSeries = async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: volumesKey(SERIES) } });
  await prisma.book.deleteMany({
    where: { isbn13: { in: VOLUMES.map(ISBN) } },
  });
};

// A reader, and their id. `shelf`: the series on their shelf, with the
// volumes they own or how far they've read; null for a reader without it
export async function member(
  username: string,
  shelf: { owned?: number[]; readVolume?: number } | null,
) {
  const userId = (await userQueries.addUser(username, "a good password"))!;
  if (shelf) {
    const owned = shelf.owned ?? [];
    await prisma.manga.create({
      data: {
        userId,
        name: SERIES,
        ownedList: owned,
        volumesOwned: owned.length ? Math.max(...owned) : null,
        readVolume: shelf.readVolume ?? null,
      },
    });
  }
  return userId;
}

// that reader, signed in (sign-ins are limited: only where a test needs one)
export async function signedIn(username: string) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password: "a good password" })
    .expect(200);
  return agent;
}
