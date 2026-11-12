// The shelf: the manga each user tracks.
import { prisma } from "../config/prisma.js";
import type { Manga } from "../../generated/prisma/client.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";

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

// new ones from an import, or a Select's undo (RestoredManga is a MangaInput
// with more kept)
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

// a cover found for it after an import (the shelf fills them in)
export const setImage = (id: number, image: string) =>
  prisma.manga.update({ where: { id }, data: { image } });

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

// two entries of one series on a shelf become one: `keep` gets everything the
// other had that it lacks (every volume either owns, the further chapter and
// "seen" marks, a rating, cover, genre and notes it didn't have), then the
// other goes. One transaction, so it's both or neither
export async function mergeManga(keep: number, other: number) {
  return prisma.$transaction(async (tx) => {
    const [a, b] = await Promise.all([
      tx.manga.findUniqueOrThrow({ where: { id: keep } }),
      tx.manga.findUniqueOrThrow({ where: { id: other } }),
    ]);
    const setOf = (m: typeof a) =>
      m.ownedList.length
        ? m.ownedList
        : Array.from({ length: m.volumesOwned ?? 0 }, (_, i) => i + 1);
    const owned = ownedVolumes(null, [...setOf(a), ...setOf(b)]);
    const most = (x: number | null, y: number | null) =>
      x == null ? y : y == null ? x : Math.max(x, y);
    const notes = [a.description, b.description]
      .map((d) => d?.trim())
      .filter((d, i, all): d is string => Boolean(d) && all.indexOf(d) === i)
      .join("\n")
      .slice(0, 450);
    await tx.manga.update({
      where: { id: keep },
      data: {
        ...owned,
        bookmark: most(a.bookmark, b.bookmark),
        rating: a.rating || b.rating,
        image: a.image || b.image,
        genre: a.genre || b.genre,
        description: notes || null,
        // finished in either is finished; on To read only if both were
        status: a.status || b.status,
        planned: a.planned && b.planned && !(a.status || b.status),
        seenVolume: most(a.seenVolume, b.seenVolume),
        seenChapter: most(a.seenChapter, b.seenChapter),
        seenJapanVolume: most(a.seenJapanVolume, b.seenJapanVolume),
        hiddenVolumes: [...new Set([...a.hiddenVolumes, ...b.hiddenVolumes])],
        latestChapter: most(a.latestChapter, b.latestChapter),
      },
    });
    await tx.manga.delete({ where: { id: other } });
  });
}

export const deleteManga = (id: number) =>
  prisma.manga.delete({ where: { id } });

// only theirs: an id that belongs to someone else matches nothing. Read and
// deleted in one transaction, so it's all or none, and what comes back is
// exactly what went (for its undo)
export const deleteManyManga = async (userId: number, ids: number[]) => {
  const where = { userId, id: { in: ids } };
  const [rows] = await prisma.$transaction([
    prisma.manga.findMany({ where }),
    prisma.manga.deleteMany({ where }),
  ]);
  return rows;
};

// the shelf's Select: where each series was, for the undo
export type ShelfPlace = {
  id: number;
  status: boolean;
  planned: boolean;
  bookmark: number | null;
};
export type ShelfMove = "finished" | "planned" | "reading";

// several moved at once, as their own buttons would: finishing takes it off To
// read, To read unfinishes it, and Reading takes it off both (one that hadn't
// started is put at chapter 1). Says where each was
export const moveManyManga = async (
  userId: number,
  ids: number[],
  to: ShelfMove,
) => {
  const where = { userId, id: { in: ids } };
  const select = { id: true, status: true, planned: true, bookmark: true };
  const moves =
    to === "finished"
      ? [
          prisma.manga.updateMany({
            where,
            data: { status: true, planned: false },
          }),
        ]
      : to === "planned"
        ? [
            prisma.manga.updateMany({
              where,
              data: { planned: true, status: false },
            }),
          ]
        : [
            prisma.manga.updateMany({
              where: { ...where, planned: true, bookmark: null },
              data: { bookmark: 1 },
            }),
            prisma.manga.updateMany({
              where,
              data: { status: false, planned: false },
            }),
          ];
  const [rows] = await prisma.$transaction([
    prisma.manga.findMany({ where, select }),
    ...moves,
  ]);
  return rows as ShelfPlace[];
};

// the undo: each back where it was. Series that were in the same place go
// back together, so a whole shelf is a handful of updates
export const placeManyManga = async (userId: number, places: ShelfPlace[]) => {
  const groups = new Map<string, ShelfPlace[]>();
  for (const p of places) {
    const key = `${p.status}|${p.planned}|${p.bookmark}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const results = await prisma.$transaction(
    [...groups.values()].map((group) =>
      prisma.manga.updateMany({
        where: { userId, id: { in: group.map((p) => p.id) } },
        data: {
          status: group[0]!.status,
          planned: group[0]!.planned,
          bookmark: group[0]!.bookmark,
        },
      }),
    ),
  );
  return results.reduce((sum, r) => sum + r.count, 0);
};

export default {
  setImage,
  moveManyManga,
  placeManyManga,
  setNotes,
  getShelf,
  getMangaShelfNames,
  getManga,
  addManga,
  mergeManga,
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
};
