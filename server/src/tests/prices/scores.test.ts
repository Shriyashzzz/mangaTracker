// Which score a series shows (prices/scores.ts) and MyAnimeList's answer as
// a score (prices/sources/myAnimeList.ts).
import { bestScore } from "../../prices/scores.js";
import { ratingOf } from "../../prices/sources/mangaUpdates.js";
import { scoreFromAnswer } from "../../prices/sources/myAnimeList.js";

test("MyAnimeList's score shows first, then AniList's average", () => {
  expect(bestScore(80, { malScore: 85, muScore: 70, meanScore: 79 })).toEqual({
    score: 85,
    fewRaters: false,
  });
  expect(bestScore(80, { malScore: null, muScore: 70, meanScore: 79 })).toEqual(
    {
      score: 80,
      fewRaters: false,
    },
  );
  // nothing saved for it yet: AniList's own
  expect(bestScore(80, undefined)).toEqual({ score: 80, fewRaters: false });
});

test("with neither, MangaUpdates' rating is the backup", () => {
  expect(
    bestScore(null, { malScore: null, muScore: 78, meanScore: 69 }),
  ).toEqual({ score: 78, fewRaters: false });
});

test("with none of the three, AniList's plain mean shows, marked as few raters", () => {
  expect(
    bestScore(null, { malScore: null, muScore: null, meanScore: 69 }),
  ).toEqual({
    score: 69,
    fewRaters: true,
  });
});

test("a series nobody has scored anywhere has no score", () => {
  expect(
    bestScore(null, { malScore: null, muScore: null, meanScore: null }),
  ).toEqual({
    score: null,
    fewRaters: false,
  });
  expect(bestScore(null, undefined)).toEqual({ score: null, fewRaters: false });
});

test("MyAnimeList's 8.52 out of 10 is 85 out of 100", () => {
  expect(scoreFromAnswer({ mean: 8.52, num_scoring_users: 1200 })).toEqual({
    score: 85,
    raters: 1200,
  });
});

test("an entry with too few raters has no mean: no score", () => {
  expect(scoreFromAnswer({ num_scoring_users: 12 })).toEqual({
    score: null,
    raters: 12,
  });
  expect(scoreFromAnswer({})).toEqual({ score: null, raters: null });
});

test("MangaUpdates' 7.84 out of 10 is 78 out of 100, when anyone has voted", () => {
  expect(ratingOf({ bayesian_rating: 7.84, rating_votes: 40 })).toEqual({
    score: 78,
    raters: 40,
  });
  // its rating with no votes is only the site's average
  expect(ratingOf({ bayesian_rating: 7.1, rating_votes: 0 })).toEqual({
    score: null,
    raters: 0,
  });
});
