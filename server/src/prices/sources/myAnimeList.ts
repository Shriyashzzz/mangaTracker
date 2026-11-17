// MyAnimeList's score for a series, from its official API: the score the
// site shows first (prices/scores.ts). Asked by MyAnimeList's own id, which
// AniList gives for each series, never by name.
//
// Needs MAL_CLIENT_ID (config.ts). Only the background asks
// (collector/scoreFiller.ts); pages read what's saved.
// https://myanimelist.net/apiconfig/references/api/v2
import config from "../../config/config.js";

export const malOn = () => Boolean(config.MAL_CLIENT_ID);

// what we ask of a manga: its score and how many people gave one
type Answer = { mean?: number | null; num_scoring_users?: number | null };

export type MalScore = {
  // out of 100, like AniList's; null when too few people have rated it
  score: number | null;
  raters: number | null;
};

// MyAnimeList scores out of 10 ("8.52"); ours are out of 100
export function scoreFromAnswer(answer: Answer): MalScore {
  const mean = Number(answer.mean);
  return {
    score: Number.isFinite(mean) && mean > 0 ? Math.round(mean * 10) : null,
    raters: answer.num_scoring_users ?? null,
  };
}

// one series' score. No entry by that id is an answer (no score); anything
// else that goes wrong throws, so nothing false is saved
export async function malScore(malId: number): Promise<MalScore> {
  const res = await fetch(
    `https://api.myanimelist.net/v2/manga/${malId}?fields=mean,num_scoring_users`,
    {
      headers: { "X-MAL-CLIENT-ID": config.MAL_CLIENT_ID! },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (res.status === 404) return { score: null, raters: null };
  if (!res.ok) throw new Error(`MyAnimeList responded ${res.status}`);
  return scoreFromAnswer((await res.json()) as Answer);
}
