// A series' score from readers: a small "★ 4.6" badge hanging on the corner
// of its cover, over the cover's edge. It's the average of the stars readers
// gave the series on their shelves, and only exists once enough of them
// have (the server sends nothing before that): see the server's
// reviews/seriesScore.ts.
//
// The badge's parent is the box around the cover (styles.scoredCover), not
// the cover, which clips. A card in a list finds its score with
// useSeriesScore.ts.
import { StarIcon } from "../../components/icons/Icons";
import { scoreText } from "./reviews/reviewText";
import { pricesStyles as styles } from "./styles";

export function SeriesScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <span
      className={styles.seriesScore}
      aria-label={`Readers rate it ${scoreText(score)} out of 5`}
    >
      <StarIcon filled aria-hidden />
      {scoreText(score)}
    </span>
  );
}
