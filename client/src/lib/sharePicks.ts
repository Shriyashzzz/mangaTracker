// "I have this too": the series a visitor without an account marks on
// someone's shared shelf. They're kept on the device, and when the visitor
// signs up they become the start of their own shelf, so the first thing
// they see is a shelf with their manga on it and how it compares.
//
// Only what's needed to add a series is kept: its name, cover, genre and
// whether it's the light novel.
import { apiFetch } from "./api";
import { readLocal, writeLocal } from "./prefs";

export type SharePick = {
  name: string;
  image: string | null;
  genre: string | null;
  lightNovel?: boolean;
};

const KEY = "sharePicks";
// enough to start a shelf; past this they have one to add to
const MOST = 60;

const sameSeries = (a: SharePick, b: SharePick) =>
  a.name === b.name && Boolean(a.lightNovel) === Boolean(b.lightNovel);

export function readPicks(): SharePick[] {
  try {
    const saved: unknown = JSON.parse(readLocal(KEY) ?? "[]");
    return Array.isArray(saved) ? (saved as SharePick[]) : [];
  } catch {
    return [];
  }
}

// marks it, or unmarks one that's marked; the list as it is afterwards
export function togglePick(series: SharePick): SharePick[] {
  const picks = readPicks();
  const next = picks.some((p) => sameSeries(p, series))
    ? picks.filter((p) => !sameSeries(p, series))
    : [
        ...picks,
        {
          name: series.name,
          image: series.image,
          genre: series.genre,
          ...(series.lightNovel ? { lightNovel: true } : {}),
        },
      ].slice(-MOST);
  writeLocal(KEY, JSON.stringify(next));
  return next;
}

export const isPicked = (picks: SharePick[], series: SharePick) =>
  picks.some((p) => sameSeries(p, series));

// Right after signing up: every pick goes onto the new shelf as a series
// they're reading (they said they have it), and the list is forgotten. One
// that fails to save is just left out: the shelf is theirs to add to
export async function addPicksToShelf() {
  const picks = readPicks();
  if (!picks.length) return;
  writeLocal(KEY, "[]");
  await Promise.all(
    picks.map((pick) =>
      apiFetch("/api/manga", {
        method: "POST",
        body: {
          name: pick.name.slice(0, 150),
          status: false,
          planned: false,
          ...(pick.lightNovel ? { lightNovel: true } : {}),
          ...(pick.image ? { image: pick.image } : {}),
          ...(pick.genre && pick.genre !== "unlabled"
            ? { genre: pick.genre }
            : {}),
        },
      }).catch(() => null),
    ),
  );
}
