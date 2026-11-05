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
  // the exact volumes, when not a run from 1 (util/shelf/ownedList.ts)
  ownedList?: number[];
  rating?: number | null;
  // only imports set it: a finished series' last chapter, from AniList. Release
  // checks keep it up to date after that
  latestChapter?: number | null;
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

// what release checks saved for it: latest chapter, what's been seen and hidden
export const clearReleaseMarks = (id: number) =>
  prisma.manga.update({
    where: { id },
    data: {
      latestChapter: null,
      seenVolume: null,
      seenChapter: null,
      seenJapanVolume: null,
      hiddenVolumes: [],
    },
  });

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
// what they own: "up to" a volume, or the exact list (util/shelf/ownedList.ts)
export const setVolumesOwned = (
  id: number,
  owned: { volumesOwned: number | null; ownedList: number[] },
) =>
  prisma.manga.update({
    where: { id },
    data: owned,
    select: { volumesOwned: true, ownedList: true },
  });

export const deleteManga = (id: number) =>
  prisma.manga.delete({ where: { id } });

// only theirs: an id that belongs to someone else matches nothing. All in one
// statement, so it's all or none. How many went
export const deleteManyManga = async (userId: number, ids: number[]) =>
  (await prisma.manga.deleteMany({ where: { userId, id: { in: ids } } }))
    .count;

export const restoreManyManga = (userId: number, inputs: RestoredManga[]) =>
  prisma.manga.createMany({
    data: inputs.map((input) => ({ ...input, userId })),
  });

export default {
  setNotes,
  getShelf,
  getMangaShelfNames,
  getManga,
  addManga,
  restoreManga,
  setLatestChapter,
  updateManga,
  clearReleaseMarks,
  setStatus,
  setPlanned,
  setRating,
  addManyManga,
  setBookmark,
  setSeen,
  setVolumesOwned,
  deleteManga,
  deleteManyManga,
  restoreManyManga,
};
