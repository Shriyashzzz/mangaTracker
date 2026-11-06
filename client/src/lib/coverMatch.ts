// Which series the shelf looks covers up for (lib/coverFill.ts), and when an
// AniList title is the same series' title. Pure, so the server's Jest can
// test it.
import type { Manga } from "./types";

// not asked about again for a week once it's been tried
export const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
// a visit's worth; the rest wait for the next visit
export const MOST_PER_VISIT = 40;

// "Frieren: Beyond Journey's End" and "FRIEREN - Beyond Journey’s End" are the
// same title; "Berserk" and "Berserk of Gluttony" aren't
export const sameTitle = (a: string, b: string) => {
  const key = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  const ka = key(a);
  return ka.length > 0 && ka === key(b);
};

// the ones worth asking about now
export const needingCovers = (
  manga: Manga[],
  tried: Record<string, number>,
  now: number,
) =>
  manga
    .filter((m) => !m.image && now - (tried[m.id] ?? 0) >= RETRY_AFTER_MS)
    .slice(0, MOST_PER_VISIT);
