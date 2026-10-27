// The shelf: the manga each user tracks.
import { prisma } from "../config/prisma.js";
import type { Manga } from "../../generated/prisma/client.js";

// the fields a user can set when adding or editing a manga
export type MangaInput = {
  name: string;
  genre?: string | null;
  description?: string | null;
  image?: string | null;
  status: boolean;
  bookmark?: number | null;
  volumesOwned?: number | null;
};

// one user's shelf, furthest-read first (the order the JS version used)
export const getShelf = (userId: number): Promise<Manga[]> =>
  prisma.manga.findMany({
    where: { userId },
    orderBy: { bookmark: { sort: "desc", nulls: "first" } },
  });

export const getManga = (id: number): Promise<Manga | null> =>
  prisma.manga.findUnique({ where: { id } });

export async function addManga(userId: number, input: MangaInput) {
  const { id } = await prisma.manga.create({
    data: { ...input, bookmark: input.bookmark ?? 0, userId },
    select: { id: true },
  });
  return id;
}

// an edit leaves the bookmark alone when the form sends none, and never
// changes the genre (the edit form doesn't have one)
export async function updateManga(id: number, input: MangaInput) {
  const { bookmark, genre: _genre, ...rest } = input;
  await prisma.manga.update({
    where: { id },
    data: { ...rest, ...(bookmark ? { bookmark } : {}) },
  });
}

export const setStatus = (id: number, status: boolean) =>
  prisma.manga.update({ where: { id }, data: { status } });

export const setRating = (id: number, rating: number) =>
  prisma.manga.update({ where: { id }, data: { rating } });

// how many volumes someone owns; null clears it. Returns the new value
export async function setVolumesOwned(id: number, volumesOwned: number | null) {
  const manga = await prisma.manga.update({
    where: { id },
    data: { volumesOwned },
    select: { volumesOwned: true },
  });
  return manga.volumesOwned;
}

export const deleteManga = (id: number) =>
  prisma.manga.delete({ where: { id } });

export default {
  getShelf,
  getManga,
  addManga,
  updateManga,
  setStatus,
  setRating,
  setVolumesOwned,
  deleteManga,
};
