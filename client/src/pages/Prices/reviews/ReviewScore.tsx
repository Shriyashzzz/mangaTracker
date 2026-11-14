// The score beside a volume's reviews: the average, big, who it's from, and
// how the ratings spread from 5 stars down to 1 (so 4.3 from "everyone
// liked it" reads differently from 4.3 from "people are split").
import StarRating from "../../../components/starRating/StarRating";
import { barWidth, scoreText, whoRated } from "./reviewText";
import { reviewStyles as styles } from "./reviewStyles";

export default function ReviewScore({
  average,
  count,
  spread,
}: {
  average: number;
  count: number;
  // how many gave 1 star, 2 … 5
  spread: number[];
}) {
  return (
    <div className={styles.score}>
      <div>
        <p className={styles.scoreNumber}>
          {scoreText(average)}
          <small>/ 5</small>
        </p>
        <StarRating value={Math.round(average)} />
        <p className={styles.scoreWho}>{whoRated(count)}</p>
      </div>
      <ul
        className={styles.bars}
        aria-label="How many readers gave each rating"
      >
        {[5, 4, 3, 2, 1].map((stars) => {
          const amount = spread[stars - 1] ?? 0;
          return (
            <li
              key={stars}
              className={styles.bar}
              aria-label={`${stars} star${stars === 1 ? "" : "s"}: ${amount}`}
            >
              <span aria-hidden>{stars}</span>
              <span className={styles.barTrack} aria-hidden>
                <span
                  className={styles.barFill}
                  style={{ width: amount ? barWidth(amount, spread) : 0 }}
                />
              </span>
              <span aria-hidden>{amount}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
