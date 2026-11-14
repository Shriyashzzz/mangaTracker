// A series' score from readers, by its name, for a card in a list
// (SeriesScore.tsx draws it). Every scored series comes in one small
// answer, asked for once a visit and shared by all the cards.
import { useEffect, useState } from "react";
import { getJson } from "../../lib/api";
import { slugify } from "../../lib/prices";

type Scores = Record<string, number>;
// asked once a visit; an extra, so a failure is just no badges
let asked: Promise<Scores> | null = null;
const allScores = () => {
  asked ??= getJson<Scores>("/api/reviews/series-scores").then(
    (scores) => scores ?? {},
    () => ({}),
  );
  return asked;
};

// `wanted` false: this card doesn't show a score, so nothing is asked
export function useSeriesScore(name: string, wanted = true): number | null {
  const [scores, setScores] = useState<Scores>({});
  useEffect(() => {
    if (!wanted) return;
    let isCurrent = true;
    allScores().then((all) => {
      if (isCurrent) setScores(all);
    });
    return () => {
      isCurrent = false;
    };
  }, [wanted]);
  return scores[slugify(name)] ?? null;
}
