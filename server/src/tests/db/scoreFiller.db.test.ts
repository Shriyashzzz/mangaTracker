// Background series scores (collector/scoreFiller.ts), with a real database
// and fake AniList, MyAnimeList and MangaUpdates: each known series is asked
// about once, by MyAnimeList's id; MangaUpdates only when the first two have
// no score; and what came back is what the series list shows. No site is
// called: fetch is replaced.
import config from "../../config/config.js";
import { fillScoresOnce, scoreQueue } from "../../collector/scoreFiller.js";
import { forgetSavedScores } from "../../prices/scores.js";
import { listKnownSeries } from "../../prices/sources/anilist.js";
import { closeDb, prisma } from "./testDb.js";

// AniList ids no real series has
const LOVED = 990000001; // on MyAnimeList, with a score
const OBSCURE = 990000002; // on MyAnimeList, too few raters for a score
const ABSENT = 990000003; // not on MyAnimeList
const IDS = [LOVED, OBSCURE, ABSENT];
const MAL_ID: Record<number, number | null> = {
  [LOVED]: 880001,
  [OBSCURE]: 880002,
  [ABSENT]: null,
};

// AniList's own average for each: the obscure one has none
const AVERAGE: Record<number, number | null> = {
  [LOVED]: 80,
  [OBSCURE]: null,
  [ABSENT]: 70,
};

const realFetch = globalThis.fetch;
let malAsked: number[] = [];
// the names MangaUpdates was searched for, and whether it knows the series
let muSearched: string[] = [];
let muKnowsIt = true;
const fakeSites = () => {
  malAsked = [];
  muSearched = [];
  muKnowsIt = true;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("graphql.anilist.co")) {
      const { variables } = JSON.parse(String(init?.body)) as {
        variables: { ids: number[] };
      };
      const media = variables.ids
        .filter((id) => IDS.includes(id))
        .map((id) => ({
          id,
          idMal: MAL_ID[id],
          meanScore: 60,
          averageScore: AVERAGE[id],
        }));
      return new Response(JSON.stringify({ data: { Page: { media } } }));
    }
    if (u.includes("api.myanimelist.net")) {
      const id = Number(u.match(/manga\/(\d+)/)![1]);
      malAsked.push(id);
      return new Response(
        JSON.stringify(
          id === MAL_ID[LOVED]
            ? { mean: 8.52, num_scoring_users: 5000 }
            : { num_scoring_users: 9 },
        ),
      );
    }
    if (u.endsWith("/series/search")) {
      const { search } = JSON.parse(String(init?.body)) as { search: string };
      muSearched.push(search);
      const results = muKnowsIt
        ? [{ record: { series_id: 777, title: search, type: "Manga" } }]
        : [];
      return new Response(JSON.stringify({ results }));
    }
    if (u.endsWith("/series/777"))
      return new Response(
        JSON.stringify({ bayesian_rating: 7.84, rating_votes: 40 }),
      );
    throw new Error(`unexpected call: ${u}`);
  }) as typeof fetch;
};

const info = (anilistId: number, score: number | null) => ({
  anilistId,
  name: `Zzscore Test ${anilistId}`,
  score,
  popularityRank: null,
  genres: [],
  description: "",
  coverUrl: null,
  siteUrl: "",
  status: null,
  volumes: null,
  altNames: [],
});

const savedKey = config.MAL_CLIENT_ID;
const clean = async () => {
  await prisma.seriesScore.deleteMany({ where: { anilistId: { in: IDS } } });
  await prisma.seriesInfo.deleteMany({
    where: { slug: { startsWith: "zzscore-test-" } },
  });
  forgetSavedScores();
};

beforeEach(async () => {
  await clean();
  config.MAL_CLIENT_ID = "test-client";
  fakeSites();
  await prisma.seriesInfo.createMany({
    data: [
      { slug: `zzscore-test-${LOVED}`, info: info(LOVED, 80) },
      { slug: `zzscore-test-${OBSCURE}`, info: info(OBSCURE, null) },
      { slug: `zzscore-test-${ABSENT}`, info: info(ABSENT, 70) },
    ],
  });
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  config.MAL_CLIENT_ID = savedKey;
  await clean();
  await closeDb();
});

const shown = async () => {
  const series = await listKnownSeries();
  return new Map(series.map((s) => [s.anilistId, s]));
};

test("each series shows MyAnimeList's score, else AniList's, else MangaUpdates'", async () => {
  expect((await shown()).get(LOVED)?.score).toBe(80);

  await fillScoresOnce(Date.now(), 0);

  const series = await shown();
  // MyAnimeList's 8.52 beats AniList's 80
  expect(series.get(LOVED)).toMatchObject({ score: 85 });
  expect(series.get(LOVED)?.fewRaters).toBeUndefined();
  // no score on either: MangaUpdates' 7.84, asked for this one only
  expect(series.get(OBSCURE)).toMatchObject({ score: 78 });
  expect(series.get(OBSCURE)?.fewRaters).toBeUndefined();
  expect(muSearched).toEqual([`Zzscore Test ${OBSCURE}`]);
  // not on MyAnimeList: AniList's average, and MyAnimeList wasn't asked
  expect(series.get(ABSENT)).toMatchObject({ score: 70 });
  expect(malAsked.sort()).toEqual([MAL_ID[LOVED], MAL_ID[OBSCURE]]);
});

test("a series looked at this week isn't asked about again", async () => {
  await fillScoresOnce(Date.now(), 0);
  const queue = await scoreQueue();
  expect(queue.filter((w) => IDS.includes(w.anilistId))).toEqual([]);

  // a week on, they're due
  const later = Date.now() + 8 * 24 * 60 * 60_000;
  const due = await scoreQueue(later);
  const dueIds = due.map((w) => w.anilistId);
  expect(IDS.every((id) => dueIds.includes(id))).toBe(true);
});

test("a series none of the three has a score for shows the plain mean, marked", async () => {
  muKnowsIt = false;
  await fillScoresOnce(Date.now(), 0);
  expect((await shown()).get(OBSCURE)).toMatchObject({
    score: 60,
    fewRaters: true,
  });
});

test("without a MyAnimeList key it isn't asked, and the others still are", async () => {
  config.MAL_CLIENT_ID = undefined;
  await fillScoresOnce(Date.now(), 0);
  expect(malAsked).toEqual([]);
  const row = await prisma.seriesScore.findUnique({
    where: { anilistId: OBSCURE },
  });
  expect(row).toMatchObject({ meanScore: 60, malScore: null, muScore: 78 });
});
