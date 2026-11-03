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
  planned?: boolean;
  lightNovel?: boolean;
  bookmark?: number | null;
  volumesOwned?: number | null;
  rating?: number | null;
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

// just enough to tell whether a title is already on someone's shelf
export const getMangaShelfNames = (userId: number) =>
  prisma.manga.findMany({
    where: { userId },
    select: { id: true, name: true, lightNovel: true },
  });

export type RestoredManga = MangaInput & {
  rating: number | null;
  seenVolume: number | null;
  seenChapter: number | null;
  seenJapanVolume: number | null;
  hiddenVolumes: number[];
  latestChapter: number | null;
};

export async function restoreManga(userId: number, input: RestoredManga) {
  const { id } = await prisma.manga.create({
    data: { ...input, userId },
    select: { id: true },
  });
  return id;
}

export const addManyManga = (userId: number, inputs: MangaInput[]) =>
  prisma.manga.createMany({
    data: inputs.map((input) => ({ ...input, userId })),
  });

// an edit leaves the bookmark and genre alone when the form sends none
export async function updateManga(id: number, input: MangaInput) {
  const { bookmark, genre, ...rest } = input;
  await prisma.manga.update({
    where: { id },
    data: {
      ...rest,
      ...(bookmark ? { bookmark } : {}),
      ...(genre ? { genre } : {}),
    },
  });
}

// finishing one, or picking it back up, takes it off the To read list
export const setStatus = (id: number, status: boolean) =>
  prisma.manga.update({ where: { id }, data: { status, planned: false } });

// on or off the To read list; starting it puts them at chapter 1
export const setPlanned = (id: number, planned: boolean) =>
  prisma.manga.update({
    where: { id },
    data: planned ? { planned, status: false } : { planned, bookmark: 1 },
  });

export const setRating = (id: number, rating: number) =>
  prisma.manga.update({ where: { id }, data: { rating } });

export const setNotes = (id: number, description: string | null) =>
  prisma.manga.update({ where: { id }, data: { description } });

export const setLatestChapter = (id: number, latestChapter: number) =>
  prisma.manga.update({ where: { id }, data: { latestChapter } });

export const setBookmark = (id: number, bookmark: number) =>
  prisma.manga.update({ where: { id }, data: { bookmark } });

const SEEN_FIELD = {
  volume: "seenVolume",
  chapter: "seenChapter",
  japan: "seenJapanVolume",
} as const;

export const setSeen = (
  id: number,
  kind: keyof typeof SEEN_FIELD,
  number: number | null,
  hiddenVolumes?: number[],
) =>
  prisma.manga.update({
    where: { id },
    data: {
      [SEEN_FIELD[kind]]: number,
      ...(hiddenVolumes ? { hiddenVolumes } : {}),
    },
  });

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
  setNotes,
  getShelf,
  getMangaShelfNames,
  getManga,
  addManga,
  restoreManga,
  setLatestChapter,
  updateManga,
  setStatus,
  setPlanned,
  setRating,
  addManyManga,
  setBookmark,
  setSeen,
  setVolumesOwned,
  deleteManga,
};
