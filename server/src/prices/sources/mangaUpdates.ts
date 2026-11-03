// MangaUpdates: free, no key. A second opinion on chapter counts, because MangaDex
// loses chapters when a series gets officially licensed: it had Solo Leveling at
// 15 of 201. Also says whether a series has finished.
// https://api.mangaupdates.com
import { slugify } from "../stores/match.js";

const BASE = "https://api.mangaupdates.com/v1";
const TIMEOUT_MS = 6000;

export type ChapterSource = { latestChapter: number | null; finished: boolean };

type Hit = {
  hit_title?: string;
  record: { series_id: number; title: string; type?: string };
};

const NOT_THE_MANGA = new Set(["Novel", "Doujinshi", "Artbook", "OEL"]);

// its search is fuzzy, so only a hit under one of the series' real names counts.
// No hit is fine; a wrong one would put another series' chapters on this one
export function pickHit(hits: Hit[], names: string[]) {
  const wanted = new Set(names.map(slugify).filter(Boolean));
  return (
    hits.find(
      (hit) =>
        !NOT_THE_MANGA.has(hit.record.type ?? "") &&
        (wanted.has(slugify(hit.record.title)) ||
          wanted.has(slugify(hit.hit_title ?? ""))),
    ) ?? null
  );
}

const ask = async <T>(path: string, body?: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MangaUpdates responded ${res.status}`);
  return (await res.json()) as T;
};

export async function getChapterSource(
  names: string[],
): Promise<ChapterSource | null> {
  try {
    const { results } = await ask<{ results: Hit[] }>("/series/search", {
      search: names[0],
      perpage: 8,
    });
    const hit = pickHit(results, names);
    if (!hit) return null;
    const series = await ask<{ latest_chapter?: number; completed?: boolean }>(
      `/series/${hit.record.series_id}`,
    );
    return {
      latestChapter: series.latest_chapter || null,
      finished: Boolean(series.completed),
    };
  } catch (e) {
    console.error("MangaUpdates lookup failed:", (e as Error).message);
    return null;
  }
}
