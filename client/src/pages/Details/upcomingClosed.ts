// The red bar's notices of what's still coming (a preorder, an expected
// chapter) that someone has closed, kept in this browser. Only the notice:
// the release itself isn't marked seen, so the day it's out the bar says so
// and the New tab lists it as it should
import { readLocal, writeLocal } from "../../lib/prefs";

const KEY = "upcomingClosed";
// the most kept: an old one is never asked about again anyway
const MOST = 200;

const keyOf = (mangaId: number, kind: "volume" | "chapter", n: number) =>
  `${mangaId}:${kind}:${n}`;

const readClosed = (): string[] => {
  try {
    const saved = JSON.parse(readLocal(KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export const isUpcomingClosed = (
  mangaId: number,
  kind: "volume" | "chapter",
  n: number,
) => readClosed().includes(keyOf(mangaId, kind, n));

export function closeUpcoming(
  mangaId: number,
  kind: "volume" | "chapter",
  n: number,
) {
  const key = keyOf(mangaId, kind, n);
  const kept = readClosed().filter((k) => k !== key);
  writeLocal(KEY, JSON.stringify([...kept, key].slice(-MOST)));
}
