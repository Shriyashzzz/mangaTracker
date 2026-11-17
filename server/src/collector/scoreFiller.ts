// Background series scores: MyAnimeList's score, MangaUpdates' rating and
// AniList's plain mean for every series the site knows, saved in
// series_scores so no page waits on any of them (prices/scores.ts says
// which one shows).
//
// Every 5 minutes it takes up to 25 series: the ones never looked at first,
// then the ones last looked at over a week ago. One AniList request gives
// their MyAnimeList ids and scores; then MyAnimeList is asked for each, a
// second apart. MangaUpdates is the backup: asked only about a manga with
// no MyAnimeList score and no AniList average, by its real names. A few
// hundred series take about two hours the first time.
//
// Runs where the price filler runs (production, or PRICE_FILL=on). Without
// MAL_CLIENT_ID it still saves the other two.
import { prisma } from "../config/prisma.js";
import {
  getMalIdsAndMeans,
  listKnownSeries,
} from "../prices/sources/anilist.js";
import { isNovelName } from "../prices/lightNovel.js";
import { getMuRating } from "../prices/sources/mangaUpdates.js";
import { malOn, malScore } from "../prices/sources/myAnimeList.js";
import { forgetSavedScores } from "../prices/scores.js";
import { fillSwitchOn, startEvery } from "./fillShared.js";

const EVERY_MS = 5 * 60_000;
const A_RUN = 25;
const FRESH_MS = 7 * 24 * 60 * 60_000;
const BETWEEN_MAL_CALLS_MS = 1000;

type Waiting = { anilistId: number; names: string[] };

// the series to look at next, with the names MangaUpdates may know them by.
// Database only
export async function scoreQueue(now = Date.now()): Promise<Waiting[]> {
  const [series, rows] = await Promise.all([
    listKnownSeries(),
    prisma.seriesScore.findMany({
      select: { anilistId: true, checkedAt: true },
    }),
  ]);
  const checked = new Map(
    rows.map((r) => [r.anilistId, r.checkedAt.getTime()]),
  );
  const lastLook = (id: number) => checked.get(id) ?? -Infinity;
  return (
    series
      // a row saved without an id (a novel built from the catalog) has no
      // AniList entry to ask about
      .filter((s) => Number.isInteger(s.anilistId))
      .filter((s) => now - lastLook(s.anilistId) >= FRESH_MS)
      .sort((a, b) => lastLook(a.anilistId) - lastLook(b.anilistId))
      .slice(0, A_RUN)
      .map((s) => ({
        anilistId: s.anilistId,
        names: [s.name, ...(s.altNames ?? [])],
      }))
  );
}

// MyAnimeList's score for a series. Undefined with no key: what's saved is
// left as it is
async function askMal(malId: number | null, pauseMs: number) {
  if (!malOn()) return undefined;
  if (malId == null) return { score: null, raters: null };
  const answer = await malScore(malId);
  await new Promise((done) => setTimeout(done, pauseMs));
  return answer;
}

// one run. Says how many series it saved, for the log and the tests. If a
// site stops answering the run ends there: the rest wait for the next
export async function fillScoresOnce(
  now = Date.now(),
  betweenMalCallsMs = BETWEEN_MAL_CALLS_MS,
) {
  const waiting = await scoreQueue(now);
  if (!waiting.length) return { saved: 0 };
  const fromAniList = await getMalIdsAndMeans(waiting.map((w) => w.anilistId));
  let saved = 0;
  for (const { anilistId, names } of waiting) {
    const {
      malId = null,
      meanScore = null,
      averageScore = null,
    } = fromAniList.get(anilistId) ?? {};
    const mal = await askMal(malId, betweenMalCallsMs);
    // the backup: only for a manga neither of the first two has a score for
    // (MangaUpdates' novels are left out: a manga's rating isn't its novel's)
    const needsBackup =
      mal?.score == null && averageScore == null && !isNovelName(names[0]!);
    const mu = needsBackup
      ? await getMuRating(names)
      : { score: null, raters: null };
    const scores = {
      malId,
      meanScore,
      ...(mal ? { malScore: mal.score, malRaters: mal.raters } : {}),
      muScore: mu.score,
      muRaters: mu.raters,
      checkedAt: new Date(now),
    };
    await prisma.seriesScore.upsert({
      where: { anilistId },
      create: { anilistId, ...scores },
      update: scores,
    });
    saved++;
    forgetSavedScores();
  }
  return { saved };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startScoreFiller() {
  if (timer || !fillSwitchOn()) return;
  const run = async () => {
    const { saved } = await fillScoresOnce();
    if (saved) console.log(`Series scores: saved ${saved}`);
  };
  timer = startEvery("Series score filling", run, {
    everyMs: EVERY_MS,
    firstAfterMs: 120_000,
  });
  console.log(
    `Series scores on: ${malOn() ? "MyAnimeList, " : "no MAL_CLIENT_ID, so only "}AniList and MangaUpdates`,
  );
}
