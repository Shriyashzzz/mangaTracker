// "Your reviews", folded away under a series like "Your books": what the
// reader has said about each volume, latest first, with the way to change
// it. Only volumes they've rated: the ones still to rate are asked about
// one at a time (RateVolume), never listed as chores.
import { useState } from "react";
import StarRating from "../../components/starRating/StarRating";
import type { WrittenReview } from "../../lib/reviews";
import { detailsStyles as styles } from "./styles";

// how many rows show at first, and how many each press adds
const STEP = 5;

export default function YourReviews({
  written,
  onEdit,
}: {
  written: WrittenReview[];
  // the page opens the review box for this one
  onEdit: (review: WrittenReview) => void;
}) {
  const [shown, setShown] = useState(STEP);
  if (!written.length) return null;
  const rows = written.slice(0, shown);
  const left = written.length - rows.length;

  return (
    <details className={styles.books}>
      <summary className={styles.booksSummary}>
        Your reviews <span className={styles.booksCount}>{written.length}</span>
      </summary>
      <ul className={styles.booksList}>
        {rows.map((one) => (
          <li key={one.isbn13} className={styles.reviewRow}>
            <span className={styles.reviewVolume}>Vol. {one.volume}</span>
            <StarRating value={one.review.rating} size="sm" />
            <button
              type="button"
              className={styles.reviewEdit}
              onClick={() => onEdit(one)}
              aria-label={`${one.review.text ? "Edit" : "Add words to"} your review of vol. ${one.volume}`}
            >
              {one.review.text ? "Edit" : "Add words"}
            </button>
            {one.review.text ? (
              <p className={styles.reviewWords}>{one.review.text}</p>
            ) : (
              <p className={styles.reviewNoWords}>A rating, no words yet.</p>
            )}
            {one.review.hidden && (
              <p className={styles.reviewNoWords}>
                Hidden for now: readers reported it, and it's being looked at.
              </p>
            )}
          </li>
        ))}
      </ul>
      {left > 0 && (
        <button
          type="button"
          className={styles.booksMore}
          onClick={() => setShown(shown + STEP)}
        >
          Show {Math.min(STEP, left)} more
          <span className={styles.booksCount}>{left} left</span>
        </button>
      )}
      <p className={styles.booksNote}>
        Shown on each volume's price page, under your display name.
      </p>
    </details>
  );
}
