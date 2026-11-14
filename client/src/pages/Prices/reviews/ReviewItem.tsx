// One reader's review in a volume's list: who, their stars, their words (a
// spoiler stays inked out until tapped), and for a signed-in reader the two
// flags, "Spoiler?" and "Report".
import { useState } from "react";
import Avatar from "../../../components/avatar/Avatar";
import StarRating from "../../../components/starRating/StarRating";
import { timeAgo } from "../../../lib/prices";
import { flagReview, type Review } from "../../../lib/reviews";
import { writtenText } from "./reviewText";
import { reviewStyles as styles } from "./reviewStyles";

export default function ReviewItem({
  review,
  // someone who has read the volume can't be spoiled: theirs are open
  hasRead,
  // only a signed-in reader can flag
  mayFlag,
}: {
  review: Review;
  hasRead: boolean;
  mayFlag: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  // the flags this reader has sent from here, and one that didn't go
  const [sent, setSent] = useState<{ spoiler?: boolean; report?: boolean }>({});
  const [failed, setFailed] = useState(false);

  const flag = async (kind: "spoiler" | "report") => {
    setFailed(false);
    const ok = await flagReview(review.id, kind);
    if (ok) setSent((before) => ({ ...before, [kind]: true }));
    else setFailed(true);
  };

  const inkedOut = review.spoiler && !hasRead && !revealed;
  return (
    <li className={styles.item}>
      <div className={styles.itemTop}>
        <span className={styles.who}>
          <Avatar id={review.avatar} className={styles.face} />
          <b>{review.by}</b>
          <StarRating value={review.rating} size="sm" />
        </span>
        <span className={styles.when}>
          {writtenText(review.writtenAt, timeAgo)}
          {review.edited && " · edited"}
        </span>
      </div>
      {inkedOut ? (
        <button
          type="button"
          className={styles.spoiler}
          onClick={() => setRevealed(true)}
        >
          <i />
          <i />
          <i />
          <span className={styles.spoilerLabel}>
            <b>Spoiler · tap to read</b>
          </span>
        </button>
      ) : (
        <p className={styles.text}>{review.text}</p>
      )}
      {mayFlag && !review.yours && (
        <div className={styles.acts}>
          {!review.spoiler &&
            (sent.spoiler ? (
              <span className={styles.said}>Marked as a spoiler. Thanks.</span>
            ) : (
              <button
                type="button"
                className={styles.link}
                onClick={() => flag("spoiler")}
              >
                Spoiler?
              </button>
            ))}
          {sent.report ? (
            <span className={styles.said}>Reported. Thanks.</span>
          ) : (
            <button
              type="button"
              className={styles.link}
              onClick={() => flag("report")}
            >
              Report
            </button>
          )}
          {failed && (
            <span className={styles.said} role="status">
              That didn't send. Try again.
            </span>
          )}
        </div>
      )}
    </li>
  );
}
