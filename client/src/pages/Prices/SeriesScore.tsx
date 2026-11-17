// A series' score: a small "★ 4.6" badge hanging on the corner of its
// cover, over the cover's edge. The score is MyAnimeList's, or AniList's
// when it has none (server prices/scores.ts; a series' `score`,
// out of 100), said in stars out of 5 because that's how readers think of
// a rating: 91% is 4.6.
//
// The badge's parent is the box around the cover (styles.scoredCover), not
// the cover, which clips.
import { StarIcon } from "../../components/icons/Icons";
import { starsOf } from "./reviews/reviewText";
import { pricesStyles as styles } from "./styles";

export function SeriesScoreBadge({ percent }: { percent?: number | null }) {
  if (!percent) return null;
  const said = `Rated ${starsOf(percent)} out of 5`;
  return (
    <span className={styles.seriesScore} aria-label={said} title={said}>
      <StarIcon filled aria-hidden />
      {starsOf(percent)}
    </span>
  );
}
