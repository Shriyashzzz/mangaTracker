// /api/history/year: the reader's year in manga (yearRules.ts), from their
// own shelf only. Signed in
import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireSignIn } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { ownedSet } from "../collector/shelfMath.js";
import { yearInManga } from "./yearRules.js";

// the years there can be one for: the history began in 2026
const FIRST_YEAR = 2026;

export const historyRouter = Router();

historyRouter.get(
  "/year",
  requireSignIn,
  rateLimit({ max: 30, windowMs: 60_000 }),
  async (req, res, next) => {
    try {
      const thisYear = new Date().getUTCFullYear();
      const asked = Number(req.query.year ?? thisYear);
      const year =
        Number.isInteger(asked) && asked >= FIRST_YEAR && asked <= thisYear
          ? asked
          : thisYear;
      const userId = req.session.userId!;
      const from = new Date(Date.UTC(year, 0, 1));
      const to = new Date(Date.UTC(year + 1, 0, 1));
      const [events, books, reviews, shelf] = await Promise.all([
        prisma.shelfEvent.findMany({
          where: { userId, at: { gte: from, lt: to } },
          select: { series: true, kind: true, amount: true, at: true },
        }),
        prisma.ownedBook.findMany({
          where: { manga: { userId }, boughtOn: { gte: from, lt: to } },
          select: { paidCents: true, boughtOn: true },
        }),
        prisma.volumeReview.findMany({
          where: { userId, createdAt: { gte: from, lt: to } },
          select: { createdAt: true },
        }),
        prisma.manga.findMany({
          where: { userId },
          select: {
            name: true,
            genre: true,
            rating: true,
            image: true,
            volumesOwned: true,
            ownedList: true,
          },
        }),
      ]);
      res.json(
        yearInManga(
          year,
          events,
          books,
          reviews.map((r) => r.createdAt),
          shelf.map((m) => ({
            name: m.name,
            genre: m.genre,
            rating: m.rating,
            image: m.image,
            owned: ownedSet(m).size,
          })),
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);
