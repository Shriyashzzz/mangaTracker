// Covers for series that came in without one (most often an import): the
// shelf looks each up on AniList in the background, a few seconds apart so it
// stays well inside AniList's pace, and keeps one only when AniList's title is
// the same series' title. Anything it couldn't find is left alone for a week
// before it's asked about again. Remembered in this browser.
import { apiFetch } from "./api";
import { searchCovers } from "./anilist";
import { readLocal, writeLocal } from "./prefs";
import type { Manga } from "./types";
import { needingCovers, sameTitle } from "./coverMatch";

const TRIED_KEY = "coverFillTried";
// well under AniList's 30 or so a minute, which the add form shares
const GAP_MS = 2500;

const readTried = (): Record<string, number> => {
  try {
    return JSON.parse(readLocal(TRIED_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

// looks them up one by one, saving each cover it's sure of; onFound puts it
// on the shelf straight away
export async function fillCovers(
  manga: Manga[],
  signal: AbortSignal,
  onFound: (id: number, cover: string) => void,
) {
  const queue = needingCovers(manga, readTried(), Date.now());
  for (const m of queue) {
    if (signal.aborted) return;
    try {
      const hits = await searchCovers(m.name, signal);
      const hit = hits.find(
        (h) =>
          h.cover &&
          h.lightNovel === Boolean(m.lightNovel) &&
          sameTitle(h.title, m.name),
      );
      if (hit) {
        const res = await apiFetch(`/api/manga/${m.id}/image`, {
          method: "PATCH",
          body: { image: hit.cover },
          signal,
        });
        if (res.ok) onFound(m.id, hit.cover);
      }
    } catch {
      if (signal.aborted) return;
    }
    // asked about, found or not: not again for a while
    writeLocal(
      TRIED_KEY,
      JSON.stringify({ ...readTried(), [m.id]: Date.now() }),
    );
    await wait(GAP_MS, signal);
  }
}
